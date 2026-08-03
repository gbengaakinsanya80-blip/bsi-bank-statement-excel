# Bank Statement Intelligence (BSI)

AI bank statement → Excel converter. Drop in a bank statement PDF (text or scanned), and BSI
detects the bank layout, extracts every transaction, reconciles balances, and exports a clean,
validated Excel workbook (plus CSV / JSON / PDF).

- **Hybrid extraction** — PyMuPDF text extraction + pluggable OCR backend for scanned PDFs.
  [RapidOCR](https://github.com/RapidAI/RapidOCR) (ONNX, no system deps) is installed by default
  and auto-activates for scanned pages; PaddleOCR / Tesseract remain fallbacks.
- **17 supported Nigerian bank layouts** — automatic layout detection for anything else.
- **Validation engine** — balance reconciliation, missing-row detection, duplicate detection,
  zero-skip guarantee with `is_estimated` flags.
- **Job-based async API** — upload once, poll progress, download exports.
- **SQLite persistence** — search across every statement processed on this server.

## Architecture

```
frontend/   Next.js 15 (App Router) + Tailwind UI  →  backend REST API
backend/    FastAPI + custom extraction engine + SQLite persistence
```

## Prerequisites

- Python **3.11+** (developed on 3.14).
- Node.js **18.18+** / npm.
- **Tesseract** (optional, alternative OCR for scanned PDFs): `winget install UB-Mannheim.TesseractOCR`
  and ensure `tesseract.exe` is on `PATH`. The default `rapidocr` backend needs no system binaries.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> If `pip install` fails on `onnxruntime`/`rapidocr` for your Python version, install
> `requirements.txt` then run:
> `pip uninstall -y onnxruntime rapidocr paddleocr 2>&1 | Out-Null`
> The engine keeps working — only scanned-PDF OCR is disabled.
Run:

```powershell
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Environment variables (all optional)

| Variable          | Default                  | Purpose                             |
| ----------------- | ------------------------ | ----------------------------------- |
| `BSI_DATA_DIR`    | `backend/data`           | SQLite DB + uploaded files          |
| `BSI_MAX_WORKERS` | `2`                      | Concurrent processing jobs          |
| `BSI_MAX_PAGES`   | `1000`                   | Hard limit per statement            |
| `BSI_OCR_DPI`     | `150`                    | Rasterisation DPI for OCR path      |

### Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q          # fast suite: 17-bank layout suite, amounts, exports, API flow
pytest -m qa       # PRD QA corpus: 200+ statements (all 17 banks), multi-line,
                   # 600-txn performance (<2s/page), plus real-OCR accuracy
```

## Frontend

```powershell
cd frontend
npm install
npm run dev       # http://localhost:3000
```

`NEXT_PUBLIC_API_BASE` (default `http://localhost:8000/api`) points at the backend — set it in
`.env.local` if the backend is elsewhere.

### Pages

- **Dashboard** (`/`) — upload a statement, watch progress, review validation + filtered table.
- **History** (`/history`) — all jobs, re-open any completed result via `/?job=<id>`.
- **Search** (`/search`) — keyword / date / amount / type search across every stored statement.
- **Banks** (`/templates`) — list of out-of-the-box supported bank layouts.

## Deployment

The repo is a monorepo: the backend deploys to **Render** and the frontend to **Vercel**.

### Backend → Render

`render.yaml` (repo root) is a Render Blueprint for the `bsi-backend` service (Python 3.13,
Starter plan, `rootDir: backend`, health check at `/api/health`).

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, select the repo, and apply `render.yaml`.
3. Render installs `backend/requirements.txt`, starts `uvicorn app.main:app` on `:10000`,
   and sets `BSI_DATA_DIR=/opt/render/project/src/backend/data` + `BSI_MAX_WORKERS=1`.

Persistent storage: Starter-plan services use an ephemeral disk, so uploaded PDFs and the
SQLite history database are **not** persisted across deploys/restarts by default. Attach a
[Render Disk](https://render.com/docs/disks) mounted at the `BSI_DATA_DIR` path if you want
permanent statement history and search.

### Frontend → Vercel

```powershell
cd frontend
vercel
```

During setup, add the environment variable (also used at build time):

| Variable                | Example value                  |
| ----------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_BASE`  | `https://bsi-backend.onrender.com/api` |

The frontend calls the backend directly (no `/api` proxy), so `NEXT_PUBLIC_API_BASE` must be
the **absolute, publicly reachable** backend URL. See `frontend/.env.example`.

### Notes

- The backend sends `Access-Control-Allow-Origin: *` (CORS is open) so the Vercel frontend
  can call Render directly.
- Scanned-PDF OCR (`rapidocr` + `onnxruntime`) is CPU-only and works on the Starter plan;
  very large OCR jobs may be slow — tune `BSI_MAX_PAGES` / `BSI_OCR_DPI` if needed.
- `PYTHON_VERSION` is pinned to `3.13.1` in `render.yaml` — bump it if `onnxruntime` requires
  a newer runtime.

## Export formats

| Format | Contents |
| ------ | -------- |
| `.xlsx` | 4 sheets: **Transactions**, **Summary**, **Validation**, **Charts** (native Excel charts) |
| `.csv` | Transactions (UTF-8 BOM for Excel) |
| `.json` | Full structured result |
| `.pdf` | Professional report summary |
| `.sqlite` | Standalone SQLite DB (meta/summary/transactions/validation) |

## API

| Method | Route                    | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| `GET`  | `/api/health`            | Liveness + OCR backend status            |
| `GET`  | `/api/templates`         | Supported bank layouts                   |
| `POST` | `/api/process`           | Upload PDF → returns `job_id`            |
| `GET`  | `/api/jobs`              | List all jobs                            |
| `GET`  | `/api/jobs/{id}`         | Job status + progress                    |
| `GET`  | `/api/jobs/{id}/result`  | Full parsed result (JSON)                |
| `GET`  | `/api/jobs/{id}/export`  | `?format=xlsx\|csv\|json\|pdf\|sqlite` |
| `DELETE` | `/api/jobs/{id}`       | Delete a job                             |
| `GET`  | `/api/search`            | `?q=&min_amount=&max_amount=&balance=&tx_type=&from_date=&…` |

## Accuracy model

- **Zero-skip guarantee**: lines that cannot be confidently parsed are still captured with
  `is_estimated: true` and surfaced in the validation report — never silently dropped.
- **Balance reconciliation**: every running balance is checked against its predecessor;
  `balance_errors` + `balance_reconciled` flag in the report.
- **Ground-truth tests**: the test suite regenerates statements and asserts exact transaction
  and balance match for all 17 bank templates.

## Known limitations

- **Very narrow narration columns** (realistically < 25mm, e.g. tightly compressed digital
  exports or badly rasterised scans) can cause mid-word wraps in the PDF text layer that the
  engine may join imperfectly, so a long reference like `TRF/882244917/00` could render as
  `TRF/88224491 … 7/00`. Realistic bank layouts (>= 55mm description columns) are covered by
  the 200+ statement QA corpus and extract exactly. Such rows are flagged `is_estimated: true`
  rather than silently dropped.
- **Very large OCR jobs**: scanned statements can exceed text-only processing time; tune
  `BSI_MAX_PAGES` / `BSI_OCR_DPI` if needed.
