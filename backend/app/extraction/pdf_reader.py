"""PDF reading layer.

Extracts the text layer and word geometry with PyMuPDF, decides per page
whether OCR is required (scanned pages), and rasterises those pages so an OCR
backend can recover text.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import fitz

from app.core.config import OCR_DPI, TEXT_CHAR_DENSITY_MIN, TEXT_WORD_MIN, DATA_DIR


@dataclass
class Word:
    x0: float
    top: float
    x1: float
    bottom: float
    text: str
    confidence: float = 1.0

    @property
    def center(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def vcenter(self) -> float:
        return (self.top + self.bottom) / 2.0

    @property
    def width(self) -> float:
        return self.x1 - self.x0


@dataclass
class Line:
    top: float
    bottom: float
    x0: float
    x1: float
    text: str
    words: list[Word] = field(default_factory=list)
    page_index: int = 0
    line_no: int = 0

    @property
    def center(self) -> float:
        return (self.x0 + self.x1) / 2.0


@dataclass
class Page:
    index: int
    width: float
    height: float
    text: str
    words: list[Word] = field(default_factory=list)
    needs_ocr: bool = False
    image_path: str = ""


@dataclass
class PdfDocument:
    file_path: str
    pages: list[Page] = field(default_factory=list)


def read_pdf(path: str, progress_cb: Optional[Callable[[int, str], None]] = None) -> PdfDocument:
    """Open a PDF and extract per-page text + word geometry."""
    doc = fitz.open(path)
    total = max(doc.page_count, 1)
    pdf = PdfDocument(file_path=path)
    ocr_dir = DATA_DIR / "ocr_cache"
    ocr_dir.mkdir(parents=True, exist_ok=True)

    for i, page in enumerate(doc):
        if progress_cb:
            progress_cb(int(20 * i / total), f"Reading page {i + 1}/{total}")
        width, height = page.rect.width, page.rect.height
        words = _extract_words(page)
        # Rebuild the page text from word geometry: avoids a second PyMuPDF
        # extraction pass ("text") that is roughly as costly as "words".
        text = " ".join(w.text for w in words)
        needs_ocr = _needs_ocr(text, words, width, height)
        p = Page(
            index=i,
            width=width,
            height=height,
            text=text,
            words=words,
            needs_ocr=needs_ocr,
        )
        if needs_ocr:
            p.image_path = _rasterise(page, i, ocr_dir)
        pdf.pages.append(p)

    doc.close()
    return pdf


def _extract_words(page) -> list[Word]:
    words: list[Word] = []
    try:
        raw = page.get_text("words")
    except Exception:
        raw = []
    for x0, y0, x1, y1, word, *_ in raw:
        if not word.strip():
            continue
        words.append(Word(x0=x0, top=y0, x1=x1, bottom=y1, text=word.strip()))
    return words


def _needs_ocr(text: str, words: list[Word], width: float, height: float) -> bool:
    if len(words) < TEXT_WORD_MIN:
        return True
    area = max(width * height, 1.0)
    chars = sum(1 for c in text if not c.isspace())
    return (chars / area) < TEXT_CHAR_DENSITY_MIN


def _rasterise(page, index: int, out_dir: Path) -> str:
    matrix = fitz.Matrix(OCR_DPI / 72.0, OCR_DPI / 72.0)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    target = out_dir / f"page_{index:05d}.png"
    pix.save(str(target))
    return str(target)


def cleanup_ocr_cache() -> None:
    cache = DATA_DIR / "ocr_cache"
    if cache.exists():
        for f in cache.iterdir():
            try:
                f.unlink()
            except OSError:
                pass
