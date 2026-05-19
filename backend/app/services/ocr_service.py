"""
Enhanced OCR Service — Field-level extraction with confidence scoring.
Handles rotated, blurry, and low-brightness admit cards / ID cards.
"""
import re
import io
import cv2
import numpy as np
import pytesseract
from PIL import Image
from difflib import SequenceMatcher
from ..config import settings

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

# ---------------------------------------------------------------------------
# Preprocessing Pipeline
# ---------------------------------------------------------------------------

def _deskew(image: np.ndarray) -> np.ndarray:
    """Correct slight rotations up to ±15° using moments."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) > 15:   # skip extreme rotations — likely upside-down card
        return image
    (h, w) = image.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


def preprocess_for_ocr(image_bytes: bytes) -> bytes:
    """
    Multi-stage preprocessing:
      1. Deskew
      2. Upscale small images
      3. CLAHE contrast enhancement
      4. Gaussian denoising
      5. Adaptive threshold
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return image_bytes

    # 1. Deskew
    img = _deskew(img)

    # 2. Upscale if too small for OCR
    h, w = img.shape[:2]
    if w < 1000:
        scale = 2000 / w
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # 3. Grayscale + CLAHE contrast enhancement
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 4. Gentle Gaussian denoise
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # 5. Adaptive threshold for uneven lighting
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    _, buf = cv2.imencode('.png', thresh)
    return buf.tobytes()


# ---------------------------------------------------------------------------
# Raw OCR
# ---------------------------------------------------------------------------

def extract_raw_text(image_bytes: bytes) -> str:
    """Return raw OCR text from image bytes (with preprocessing)."""
    try:
        processed = preprocess_for_ocr(image_bytes)
        image = Image.open(io.BytesIO(processed))
        # PSM 6 = single block of text; try PSM 3 as fallback
        text = pytesseract.image_to_string(image, config='--oem 3 --psm 6')
        if len(text.strip()) < 15:
            text = pytesseract.image_to_string(image, config='--oem 3 --psm 3')
        return text
    except Exception as e:
        try:
            from ..utils import metrics
            metrics.OCR_ERRORS_TOTAL.inc()
        except Exception:
            pass
        print(f"[OCR] Raw extraction error: {e}")
        return ""


# ---------------------------------------------------------------------------
# Field-Level Extraction — Admit Card
# ---------------------------------------------------------------------------

FIELD_PATTERNS = {
    "roll_number": [
        r"(?:Roll|Enrollment|Enrolment|Registration|Enroll(?:ment)?)\s*(?:No\.?|Number|Num|#)\s*[:\-]?\s*([A-Z0-9]{5,20})",
        r"\b([A-Z]{2,4}[0-9]{6,12})\b",        # e.g. CS20230042
        r"\b([0-9]{8,12})\b",                   # pure numeric
    ],
    "student_name": [
        r"(?:Student|Candidate|Name of Student|Name)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,50}?)(?:\n|Father|Roll|Enroll|Course|Branch|Sem)",
        r"(?:Name)\s*[:\-]\s*([A-Z][A-Za-z\s\.]{3,40})",
    ],
    "father_name": [
        r"(?:Father(?:'s)?|Guardian(?:'s)?)\s*(?:Name)?\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,50}?)(?:\n|Mother|Course|Roll)",
        r"(?:F/O|S/O|D/O)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,40})",
    ],
    "branch": [
        r"(?:Branch|Course|Programme|Program|Dept|Department|Stream)\s*[:\-]?\s*([A-Za-z\s\-\/\.]{3,40}?)(?:\n|Sem|Year|Session)",
    ],
    "semester": [
        r"(?:Sem(?:ester)?|SEM)\s*[:\-]?\s*(\d{1,2})",
    ],
    "centre_code": [
        r"(?:Centre\s*Code|Center\s*Code|C\.?Code)\s*[:\-]?\s*([A-Z0-9]{3,10})",
    ],
    "centre_name": [
        r"(?:Centre\s*Name|Center\s*Name|Exam\s*Centre|Examination\s*Centre)\s*[:\-]?\s*([A-Za-z\s\.,]{5,60}?)(?:\n|Centre\s*Code|Shift|Session)",
    ],
    "exam_session": [
        r"(?:Session|Exam\s*Session|Academic\s*Year)\s*[:\-]?\s*(\d{4}[-\/]\d{2,4})",
    ],
    "exam_shift": [
        r"(?:Shift|Timing|Exam\s*Shift)\s*[:\-]?\s*(Morning|Evening|Afternoon|AM|PM|[0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)",
    ],
}


def extract_fields(text: str) -> dict:
    """Extract structured fields from raw OCR text using regex patterns."""
    fields = {}
    upper_text = text.upper()

    for field, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            try:
                m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
                if m:
                    val = m.group(1).strip().strip(":-").strip()
                    # Sanitize: remove newlines inside a value
                    val = re.sub(r'\s+', ' ', val)
                    if len(val) >= 2:
                        fields[field] = val
                        break
            except Exception:
                continue

    # Fallback for roll_number: any alphanumeric token 6-15 chars
    if "roll_number" not in fields:
        candidates = re.findall(r'\b[A-Z0-9]{6,15}\b', upper_text)
        exclude = {
            "ANNUAL", "EXAM", "EXAMINATION", "STUDENT", "GENDER", "COURSE",
            "BRANCH", "SEMESTER", "SUBJECT", "CENTRE", "ADMIT", "CARD",
            "UNIVERSITY", "COLLEGE", "SESSION", "MORNING", "EVENING", "SHIFT"
        }
        filtered = [c for c in candidates if c not in exclude]
        strong = [c for c in filtered if any(x.isdigit() for x in c) and any(x.isalpha() for x in c)]
        if strong:
            fields["roll_number"] = strong[0]
        elif filtered:
            fields["roll_number"] = filtered[0]

    return fields


def extract_admit_card_fields(image_bytes: bytes) -> tuple[dict, str]:
    """
    Main entry point for admit card OCR.
    Returns (fields_dict, raw_text).
    """
    raw = extract_raw_text(image_bytes)
    fields = extract_fields(raw)
    return fields, raw


def extract_id_card_fields(image_bytes: bytes) -> tuple[dict, str]:
    """
    Entry point for ID card OCR — same pipeline.
    """
    raw = extract_raw_text(image_bytes)
    fields = extract_fields(raw)
    return fields, raw


# ---------------------------------------------------------------------------
# Fuzzy Matching Utilities
# ---------------------------------------------------------------------------

def _similarity(a: str, b: str) -> float:
    """SequenceMatcher ratio between 0.0 and 1.0."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.upper().strip(), b.upper().strip()).ratio()


def score_enrollment_match(db_enrollment: str, ocr_fields: dict, raw_text: str) -> float:
    """
    Return a 0.0–1.0 confidence that the enrollment on the card matches the DB record.
    Uses fuzzy matching to tolerate OCR character substitutions (O→0, l→1, etc.).
    """
    target = db_enrollment.upper().strip()
    extracted = ocr_fields.get("roll_number", "").upper().strip()

    # Exact match
    if extracted == target:
        return 1.0

    # Fuzzy match on extracted field
    field_score = _similarity(target, extracted)
    if field_score > 0.85:
        return field_score

    # Search raw text for any token close to target
    tokens = re.findall(r'[A-Z0-9]{5,20}', raw_text.upper())
    best = max((_similarity(target, tok) for tok in tokens), default=0.0)

    return max(field_score, best)


def score_name_match(db_name: str, ocr_fields: dict) -> float:
    """Fuzzy name match tolerating OCR errors and partial names."""
    db_name_clean = db_name.upper().strip()
    ocr_name = ocr_fields.get("student_name", "").upper().strip()
    if not ocr_name:
        return 0.0

    # Token sort: handles different word orders
    def token_sort(s):
        return " ".join(sorted(s.split()))

    score = _similarity(token_sort(db_name_clean), token_sort(ocr_name))

    # Also check if any name part from DB appears in extracted name
    db_parts = [p for p in db_name_clean.split() if len(p) > 2]
    hit_count = sum(1 for p in db_parts if p in ocr_name)
    partial = hit_count / max(len(db_parts), 1)

    return max(score, partial * 0.9)


def score_father_name_match(db_father: str, ocr_fields: dict) -> float:
    """Fuzzy father name match."""
    if not db_father:
        return 0.5   # Neutral — not all systems store father name
    ocr_father = ocr_fields.get("father_name", "").upper().strip()
    if not ocr_father:
        return 0.0
    return _similarity(db_father.upper(), ocr_father)


def fuzzy_match_enrollment(target: str, raw_text: str) -> bool:
    """Legacy helper — returns True if enrollment found in raw_text."""
    return score_enrollment_match(target, {}, raw_text) > 0.75