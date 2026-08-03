"""Pluggable OCR backends.

The engine never depends on a specific OCR stack. Backends are probed lazily
in preference order (PaddleOCR -> RapidOCR -> Tesseract) and the first usable
one wins. If none is available, the engine degrades to the PDF text layer only.
"""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from typing import Optional

from app.extraction.pdf_reader import Word

log = logging.getLogger(__name__)


@dataclass
class OcrPage:
    words: list[Word]


class OCRBackend:
    name = "base"

    def available(self) -> bool:  # pragma: no cover - trivial
        return False

    def recognize_image(self, image_path: str) -> OcrPage:
        raise NotImplementedError


class TesseractBackend(OCRBackend):
    name = "tesseract"

    def available(self) -> bool:
        return shutil.which("tesseract") is not None

    def recognize_image(self, image_path: str) -> OcrPage:
        import pytesseract
        import pandas as pd

        df = pytesseract.image_to_data(
            image_path, output_type=pytesseract.Output.DATAFRAME
        )
        words: list[Word] = []
        if df is None or df.empty:
            return OcrPage(words=words)
        for _, row in df.iterrows():
            text = str(row.get("text", "") or "").strip()
            if not text:
                continue
            conf = row.get("conf")
            conf = float(conf) if conf is not None and conf != -1 else 1.0
            x0, y0, w, h = (float(row.get(c, 0)) for c in ("left", "top", "width", "height"))
            if w <= 0 or h <= 0:
                continue
            words.append(
                Word(
                    x0=x0, top=y0, x1=x0 + w, bottom=y0 + h,
                    text=text, confidence=conf,
                )
            )
        return OcrPage(words=words)


class RapidBackend(OCRBackend):
    name = "rapidocr"

    def available(self) -> bool:
        try:
            import rapidocr  # noqa: F401
            return True
        except Exception:
            return False

    def recognize_image(self, image_path: str) -> OcrPage:
        from rapidocr import RapidOCR

        ocr = self._get_instance()
        out = ocr(image_path)
        words: list[Word] = []
        if out is None or out.boxes is None or out.txts is None:
            return OcrPage(words=words)
        scores = list(out.scores or [])
        for i, (box, text) in enumerate(zip(out.boxes, out.txts)):
            text = str(text).strip()
            if not text:
                continue
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            conf = float(scores[i]) if i < len(scores) and scores[i] is not None else 1.0
            words.append(
                Word(
                    x0=float(min(xs)), top=float(min(ys)),
                    x1=float(max(xs)), bottom=float(max(ys)),
                    text=text, confidence=conf,
                )
            )
        return OcrPage(words=words)

    def _get_instance(self):
        import logging

        logging.getLogger("RapidOCR").setLevel(logging.WARNING)
        if self._instance is None:
            from rapidocr import RapidOCR

            self._instance = RapidOCR()
        return self._instance

    _instance = None


class PaddleBackend(OCRBackend):
    name = "paddleocr"

    def available(self) -> bool:
        try:
            import paddleocr  # noqa: F401
            return True
        except Exception:
            return False

    def recognize_image(self, image_path: str) -> OcrPage:
        try:
            from paddleocr import PaddleOCR
        except Exception as exc:  # pragma: no cover - env dependent
            log.warning("paddleocr import failed: %s", exc)
            return OcrPage(words=[])
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        result = ocr.ocr(image_path, cls=True)
        words: list[Word] = []
        for page_res in result:
            if not page_res:
                continue
            for item in page_res:
                box, (text, conf) = item
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]
                if not text:
                    continue
                words.append(
                    Word(
                        x0=min(xs), top=min(ys), x1=max(xs), bottom=max(ys),
                        text=str(text).strip(),
                        confidence=float(conf) if conf is not None else 1.0,
                    )
                )
        return OcrPage(words=words)


_BACKENDS: list[OCRBackend] = []


def get_available_backend() -> Optional[OCRBackend]:
    """Return the first working OCR backend, or None."""
    global _BACKENDS
    if not _BACKENDS:
        _BACKENDS = [PaddleBackend(), RapidBackend(), TesseractBackend()]
    for backend in _BACKENDS:
        try:
            if backend.available():
                return backend
        except Exception:
            continue
    return None
