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


class WindowsBackend(OCRBackend):
    """Windows.Media.Ocr via PyWinRT — native, near-instant on Windows 10+.

    Reads an image file, runs the OS OCR engine and returns positioned words
    in image-pixel coordinates (the caller scales them to PDF points).
    """

    name = "windows"

    def available(self) -> bool:
        try:
            import winrt.windows.media.ocr as wocr  # type: ignore

            return bool(list(wocr.OcrEngine.available_recognizer_languages))
        except Exception:
            return False

    def recognize_image(self, image_path: str) -> OcrPage:
        import asyncio

        return asyncio.run(self._recognize(image_path))

    async def _recognize(self, image_path: str) -> OcrPage:
        import winrt.windows.graphics.imaging as wgi  # type: ignore
        import winrt.windows.media.ocr as wocr  # type: ignore
        from winrt.windows.storage import StorageFile  # type: ignore

        engine = self._get_engine()
        if engine is None:
            return OcrPage(words=[])
        file = await StorageFile.get_file_from_path_async(image_path)
        stream = await file.open_async(1)  # FileAccessMode.Read
        decoder = await wgi.BitmapDecoder.create_async(stream)
        bitmap = await decoder.get_software_bitmap_async()
        try:
            result = await engine.recognize_async(bitmap)
        finally:
            # Release the OS file/stream handles so the raster file is not
            # locked while later pipeline stages write to the cache.
            try:
                stream.close()
            except Exception:
                pass
            try:
                file.close()
            except Exception:
                pass

        words: list[Word] = []
        for line in result.lines:
            for w in line.words:
                text = str(w.text).strip()
                if not text:
                    continue
                r = w.bounding_rect
                words.append(
                    Word(
                        x0=float(r.x),
                        top=float(r.y),
                        x1=float(r.x + r.width),
                        bottom=float(r.y + r.height),
                        text=text,
                        confidence=1.0,
                    )
                )
        words.sort(key=lambda w: (w.top, w.x0))
        return OcrPage(words=words)

    def _get_engine(self):
        if self._engine is not None:
            return self._engine
        import winrt.windows.media.ocr as wocr  # type: ignore

        langs = list(wocr.OcrEngine.available_recognizer_languages)
        # Prefer English; the first entry may lack an OCR recognizer.
        langs.sort(key=lambda l: (l.language_tag[:2] != "en", l.language_tag))
        for lang in langs:
            try:
                eng = wocr.OcrEngine.try_create_from_language(lang)
            except OSError:
                eng = None
            if eng is not None:
                self._engine = eng
                return eng
        try:
            self._engine = wocr.OcrEngine.try_create_from_user_profile_languages()
        except OSError:
            self._engine = None
        return self._engine

    _engine = None


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


def get_all_backends() -> list[OCRBackend]:
    """Return the OCR backends in preference order (fastest first)."""
    global _BACKENDS
    if not _BACKENDS:
        _BACKENDS = [WindowsBackend(), PaddleBackend(), RapidBackend(), TesseractBackend()]
    return _BACKENDS


def get_available_backend() -> Optional[OCRBackend]:
    """Return the first working OCR backend, or None."""
    for backend in get_all_backends():
        try:
            if backend.available():
                return backend
        except Exception:
            continue
    return None
