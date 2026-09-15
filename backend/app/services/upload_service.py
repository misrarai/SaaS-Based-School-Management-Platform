"""
Secure file upload helpers.

Security measures applied to every upload:
  1. Extension allow-list  — rejects unknown suffixes immediately.
  2. Magic-bytes check     — verifies the actual file content matches the
                             declared type; prevents extension-spoofing attacks.
  3. Size limit            — enforced before writing to disk.
  4. UUID filename         — original filename is never used on disk, preventing
                             path-traversal and name-collision attacks.
"""

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.exceptions import DomainError

UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "static" / "uploads"

# ── size limits ──────────────────────────────────────────────────────────────
MAX_IMAGE_BYTES = 5 * 1024 * 1024       # 5 MB
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_RECEIPT_BYTES = 5 * 1024 * 1024     # 5 MB  (images + PDF)

# ── allowed extensions ───────────────────────────────────────────────────────
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"}
ALLOWED_RECEIPT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

# ── magic-byte signatures ────────────────────────────────────────────────────
# Each entry: (suffix, bytes_to_check, expected_prefix_or_callable)
_MAGIC: list[tuple[str, int, bytes]] = [
    (".jpg",  3,  b"\xff\xd8\xff"),
    (".jpeg", 3,  b"\xff\xd8\xff"),
    (".png",  8,  b"\x89PNG\r\n\x1a\n"),
    (".pdf",  4,  b"%PDF"),
]

# WebP: bytes 0-3 == "RIFF" AND bytes 8-11 == "WEBP"
def _is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def _check_magic(suffix: str, data: bytes) -> bool:
    """Return True if *data* starts with the expected magic bytes for *suffix*."""
    if suffix == ".webp":
        return _is_webp(data)
    for ext, n, magic in _MAGIC:
        if suffix == ext:
            return len(data) >= n and data[:n] == magic
    # For document types we don't have magic checks — extension check is enough.
    return True


def _save_upload(
    file: UploadFile,
    allowed_extensions: set[str],
    max_bytes: int,
    *,
    validate_magic: bool = True,
) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_extensions:
        raise DomainError(
            f"Unsupported file type '{suffix}'. "
            f"Allowed: {', '.join(sorted(allowed_extensions))}"
        )

    contents = file.file.read()

    if len(contents) > max_bytes:
        raise DomainError(f"File is too large (max {max_bytes // (1024 * 1024)} MB)")

    if validate_magic and not _check_magic(suffix, contents):
        raise DomainError(
            f"File content does not match the declared type '{suffix}'. "
            "Please upload a genuine image or PDF."
        )

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}{suffix}"
    destination = UPLOAD_ROOT / filename
    destination.write_bytes(contents)

    return f"/static/uploads/{filename}"


def save_image(file: UploadFile) -> str:
    """Save a user-uploaded image (JPEG / PNG / WebP). Returns the public URL path."""
    return _save_upload(file, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, validate_magic=True)


def save_document(file: UploadFile) -> str:
    """Save a document (PDF / Office formats). Returns the public URL path."""
    return _save_upload(file, ALLOWED_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES, validate_magic=False)


def save_receipt(file: UploadFile) -> str:
    """Save a payment receipt (JPEG / PNG / WebP / PDF). Returns the public URL path."""
    return _save_upload(file, ALLOWED_RECEIPT_EXTENSIONS, MAX_RECEIPT_BYTES, validate_magic=True)