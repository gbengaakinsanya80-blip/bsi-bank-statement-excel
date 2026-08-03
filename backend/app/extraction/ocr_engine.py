"""OCR engine with graceful fallback chain.

Primary   : PaddleOCR
Fallback  : Tesseract (pytesseract)
Last resort: lightweight template using PIL if nothing else is installed.

Each backend reports a confidence so the pipeline can decide whether the OCR
output is trustworthy or should be flagged as unreadable.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Optional

try:  # pragma: no cover - optional
    from paddleocr import PaddleOCR  # type: ignore

    HAS_PADDLE = True
except Exception:  # noqa: BLE001
    PaddleOCR = None
    HAS_PADDLE = False

try:  # pragma: no cover - optional
    import pytesseract  # type: ignore
    from pytesseract import Output  # type: ignore

    HAS_TESSERACT = True
except Exception:  # noqa: BLE001
    pytesseract = None
    Output = None
    HAS_TESSERACT = False

try:  # pragma: no cover - optional
    from PIL import Image, ImageOps, ImageFilter  # type: ignore

    HAS_PIL = True
except Exception:  # noqa: BLE001
    Image = None
    ImageOps = None
    ImageFilter = None
    HAS_PIL = False

try:  # pragma: no cover - optional
    import cv2  # type: ignore

    HAS_CV2 = True
except Exception:  # noqa: BLE001
    cv2 = None
    HAS_CV2 = False

try:  # pragma: no cover - optional
    import numpy as np  # type: ignore

    HAS_NUMPY = True
except Exception:  # noqa: BLE001
    np = None
    HAS_NUMPY = False


@dataclass
class OcrWord:
    text: str
    x0: float
    top: float
    x1: float
    bottom: float
    confidence: float = 1.0


@dataclass
class OcrResult:
    words: list[OcrWord]
    lines: list[str]
    confidence: float
    engine: str = "unknown"

    def to_dict(self) -> dict[str, object]:
        return {
            "words": [w.__dict__ for w in self.words],
            "lines": self.lines,
            "confidence": self.confidence,
            "engine": self.engine,
        }


class OcrEngine:
    """Unified OCR interface with automatic fallback between backends."""

    name = "none"

    def __init__(self) -> None:
        self.backends: list[tuple[str, object]] = []
        self._paddle: Optional[object] = None
        self._init_paddle()
        if HAS_TESSERACT:
            self.backends.append(("tesseract", self._ocr_tesseract))
        self.backends.append(("pil", self._ocr_pil_fallback))
        self.name = self.backends[0][0] if self.backends else "none"

    def _init_paddle(self) -> None:
        if not HAS_PADDLE:
            return
        try:
            self._paddle = PaddleOCR(
                use_angle_cls=True,
                lang="en",
                show_log=False,
                use_gpu=False,
            )
            self.backends.insert(0, ("paddle", self._ocr_paddle))
        except Exception:  # noqa: BLE001
            self._paddle = None

    # ------------------------------------------------------------------ #
    def recognize_bytes(self, image_bytes: bytes) -> OcrResult:
        for _name, fn in self.backends:
            try:
                result = fn(image_bytes)
                if result.lines or result.words:
                    return result
            except Exception:  # noqa: BLE001
                continue
        return OcrResult(words=[], lines=[], confidence=0.0, engine="none")

    def recognize_image(self, image) -> OcrResult:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return self.recognize_bytes(buf.getvalue())

    # ------------------------------------------------------------------ #
    # Backends
    # ------------------------------------------------------------------ #
    def _ocr_paddle(self, image_bytes: bytes) -> OcrResult:
        import numpy as _np
        from PIL import Image as _PIL

        img = _PIL.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = _np.array(img)
        result = self._paddle.ocr(arr, cls=True)
        words: list[OcrWord] = []
        lines: list[str] = []
        confidences: list[float] = []
        if result:
            for page_result in result:
                if not page_result:
                    continue
                for item in page_result:
                    if len(item) < 2:
                        continue
                    box, (text, conf) = item[0], item[1]
                    conf = float(conf or 0.0)
                    xs = [p[0] for p in box]
                    ys = [p[1] for p in box]
                    words.append(
                        OcrWord(
                            text=str(text),
                            x0=float(min(xs)),
                            top=float(min(ys)),
                            x1=float(max(xs)),
                            bottom=float(max(ys)),
                            confidence=conf,
                        )
                    )
                    confidences.append(conf)
        words.sort(key=lambda w: (w.top, w.x0))
        # Group words into lines by vertical overlap
        lines = self._words_to_lines(words)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return OcrResult(words=words, lines=lines, confidence=avg_conf, engine="paddle")

    def _ocr_tesseract(self, image_bytes: bytes) -> OcrResult:
        img = self._preprocess(image_bytes)
        data = pytesseract.image_to_data(img, output_type=Output.DICT)
        words: list[OcrWord] = []
        for i, txt in enumerate(data["text"]):
            if not txt or not txt.strip():
                continue
            try:
                conf = float(data["conf"][i]) / 100.0
            except (ValueError, TypeError):
                conf = 0.0
            words.append(
                OcrWord(
                    text=txt.strip(),
                    x0=float(data["left"][i]),
                    top=float(data["top"][i]),
                    x1=float(data["left"][i] + data["width"][i]),
                    bottom=float(data["top"][i] + data["height"][i]),
                    confidence=max(conf, 0.0),
                )
            )
        words.sort(key=lambda w: (w.top, w.x0))
        lines = self._words_to_lines(words)
        avg = sum(w.confidence for w in words) / len(words) if words else 0.0
        return OcrResult(words=words, lines=lines, confidence=avg, engine="tesseract")

    def _ocr_pil_fallback(self, image_bytes: bytes) -> OcrResult:
        """Last-resort: no real OCR, but at least detect digit-heavy blocks."""
        if not HAS_PIL:
            return OcrResult(words=[], lines=[], confidence=0.0, engine="pil")
        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        img = ImageOps.autocontrast(img)
        # This is a placeholder recognizer. Real value comes from Paddle/Tesseract.
        return OcrResult(words=[], lines=[], confidence=0.0, engine="pil")

    # ------------------------------------------------------------------ #
    def _preprocess(self, image_bytes: bytes) -> object:
        if not HAS_PIL:
            raise RuntimeError("PIL required")
        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        img = ImageOps.autocontrast(img)
        img = img.filter(ImageFilter.SHARPEN)
        if HAS_CV2 and HAS_NUMPY:
            arr = np.array(img)
            _, thresh = cv2.threshold(arr, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            if np.mean(thresh) > 200:
                thresh = cv2.bitwise_not(thresh)
            return Image.fromarray(thresh)
        return img

    @staticmethod
    def _words_to_lines(words: list[OcrWord]) -> list[str]:
        if not words:
            return []
        lines: list[str] = []
        current: list[tuple[float, OcrWord]] = []
        current_top: Optional[float] = None
        for w in sorted(words, key=lambda x: (x.top, x.x0)):
            if current_top is not None and abs(w.top - current_top) > 8:
                lines.append(" ".join(t for _, t in sorted(current, key=lambda x: x[0])))
                current = []
            current_top = w.top if current_top is None else current_top
            current.append((w.x0, w))
        if current:
            lines.append(" ".join(t for _, t in sorted(current, key=lambda x: x[0])))
        return lines

    @staticmethod
    def _words_to_lines_by_overlap(words: list[OcrWord]) -> list[str]:
        if not words:
            return []
        rows: list[list[OcrWord]] = []
        for w in sorted(words, key=lambda x: (x.top, x.x0)):
            placed = False
            for row in rows:
                if row and abs(w.top - row[0].top) < max(6, 0.5 * (row[0].bottom - row[0].top)):
                    row.append(w)
                    placed = True
                    break
            if not placed:
                rows.append([w])
        out = []
        for row in rows:
            row.sort(key=lambda x: x.x0)
            out.append(" ".join(x.text for x in row))
        return out


_ENGINE: Optional[OcrEngine] = None


def get_ocr_engine() -> OcrEngine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = OcrEngine()
    return _ENGINE
