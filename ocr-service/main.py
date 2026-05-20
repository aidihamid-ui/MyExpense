import os
import sys
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# --- env validation at startup ---
STORAGE_PATH = os.environ.get("STORAGE_PATH", "")
OCR_SECRET = os.environ.get("OCR_SECRET", "")

if not STORAGE_PATH:
    print("FATAL: STORAGE_PATH env var is not set", file=sys.stderr)
    sys.exit(1)
if not OCR_SECRET:
    print("FATAL: OCR_SECRET env var is not set", file=sys.stderr)
    sys.exit(1)

# Resolve once so traversal checks are path.startswith-safe
STORAGE_REAL = os.path.realpath(STORAGE_PATH)

# --- PaddleOCR singleton loaded at startup ---
_ocr = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ocr
    from paddleocr import PaddleOCR  # import here so startup errors are visible
    _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    yield


app = FastAPI(lifespan=lifespan)


class OcrRequest(BaseModel):
    path: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
def run_ocr(
    req: OcrRequest,
    x_ocr_secret: Annotated[str, Header()] = "",
):
    # Auth — must match OCR_SECRET
    if x_ocr_secret != OCR_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Path traversal guard: realpath must be inside STORAGE_REAL
    real = os.path.realpath(req.path)
    if not real.startswith(STORAGE_REAL + os.sep):
        raise HTTPException(status_code=400, detail="Path outside storage directory")

    if not os.path.isfile(real):
        raise HTTPException(status_code=404, detail="File not found")

    result = _ocr.ocr(real, cls=True)

    lines: list[str] = []
    if result:
        for block in result:
            if block:
                for line in block:
                    lines.append(line[1][0])

    return {"text": "\n".join(lines), "lines": lines}
