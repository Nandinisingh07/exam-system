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
    # Always upscale — Tesseract needs ~300dpi, webcam frames need 3x minimum
    scale = 3000 / w
    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    print(f"[OCR DEBUG] Upscaled from {w}x{h} to {img.shape[1]}x{img.shape[0]}")
    # 3. Grayscale + CLAHE contrast enhancement
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 4. Sharpen before threshold
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    gray = cv2.filter2D(gray, -1, sharpen_kernel)

    # 5. Otsu threshold — more reliable than adaptive for printed cards
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # DEBUG — saves what Tesseract actually sees
    cv2.imwrite("C:/Users/Nandini singh/Desktop/ocr_debug.png", thresh)
    print(f"[OCR DEBUG] shape={thresh.shape} min={thresh.min()} max={thresh.max()}")

    print('[OCR DEBUG] shape=' + str(thresh.shape) + ' min=' + str(thresh.min()) + ' max=' + str(thresh.max()))
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
        # Whitelist reduces garbage characters significantly
        WHITELIST = (
            '-c tessedit_char_whitelist='
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            '0123456789/.-: '
        )
        configs = [
            f'--oem 3 --psm 4 {WHITELIST}',
            f'--oem 3 --psm 6 {WHITELIST}',
            f'--oem 3 --psm 3 {WHITELIST}',
        ]
        results = []
        for cfg in configs:
            t = pytesseract.image_to_string(image, config=cfg).strip()
            results.append(t)
            print('[OCR PSM] len=' + str(len(t)) + ' preview=' + repr(t[:80]))
        
        # Pick result containing digits+letters (most likely to have enrollment)
        def has_enrollment_pattern(t):
            import re
            return bool(re.search(r'[0-9]{4}', t))
        
        ranked = [t for t in results if has_enrollment_pattern(t)]
        text = ranked[0] if ranked else max(results, key=len)
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

def _roman_to_int(s: str) -> int:
    roman = {'I':1,'V':5,'X':10,'L':50,'C':100}
    result = 0
    prev = 0
    for c in reversed(s.upper()):
        val = roman.get(c, 0)
        result += val if val >= prev else -val
        prev = val
    return result

FIELD_PATTERNS = {
    "roll_number": [
        # RGPV format: "Roll No. : 0818CL231046"
        r"Roll\s*No\.?\s*[:\-]?\s*([A-Z0-9]{8,15})",
        r"(?:Enrollment|Enrolment|Registration)\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Z0-9]{8,15})",
        r"(?:Student\s*Id|Id\s*No\.?|Student\s*Id\s*No\.?)\s*[:\-]?\s*([0-9A-Z\-]{4,15})",
        r"\b([0-9]{4}[A-Z]{2}[0-9]{6})\b",   # RGPV pattern: 0818CL231046
        r"\b([A-Z]{2,4}[0-9]{6,12})\b",
        r"\b([0-9]{8,12})\b",
    ],
    "student_name": [
        # RGPV: "Name: Miss. NANDINI SINGH  D/O  Mr. JAY PRAKASH SINGH"
        r"Name\s*[:\-]\s*(?:Miss\.|Mr\.|Mrs\.|Dr\.)?\s*([A-Z][A-Za-z\s\.]{3,40}?)\s*(?:D/O|S/O|W/O|C/O|$)",
        r"(?:Student|Candidate|Name of Student)\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,50}?)(?:\n|Father|Roll|D/O|S/O)",
        r"(?:Name)\s*[:\-]\s*([A-Z][A-Za-z\s\.]{3,40})",
    ],
    "father_name": [
        # RGPV: "D/O  Mr. JAY PRAKASH SINGH"
        r"(?:D/O|S/O|W/O)\s*(?:Mr\.|Mrs\.|Dr\.)?\s*([A-Z][A-Za-z\s\.]{3,50}?)(?:\n|Course|Roll|Centre)",
        r"(?:Father(?:'s)?|Guardian(?:'s)?)\s*(?:Name)?\s*[:\-]?\s*([A-Z][A-Za-z\s\.]{3,50}?)(?:\n|Course|Roll)",
    ],
    "branch": [
        # RGPV: "Course/Branch  B.Tech, Artificial Intelligence and Machine Learning"
        r"(?:Course[/\s]*Branch|Branch|Course|Programme)\s*[:\-]?\s*([A-Za-z\s\,\.\-\/]{5,60}?)(?:\n|Sem|Year|Session|Centre)",
    ],
    "semester": [
        r"Semester\s+([IVX]{1,4}|\d{1,2})",
        r"(?:Sem(?:ester)?|SEM)\s*[:\-]?\s*([IVX]{1,4}|\d{1,2})",
    ],
    "centre_code": [
        # RGPV: "[0818] Indore Institute..."
        r"\[(\d{4})\]",
        r"(?:Centre\s*Code|Center\s*Code)\s*[:\-]?\s*([A-Z0-9]{3,10})",
    ],
    "centre_name": [
        r"\[\d{4}\]\s*([A-Za-z\s\.,&]{5,80}?)(?:\n|Practical|Please)",
        r"(?:Centre\s*Name|Exam\s*Centre)\s*[:\-]?\s*([A-Za-z\s\.,]{5,60}?)(?:\n|Code|Shift)",
    ],
    "exam_session": [
        r"(?:Session|Exam\s*Session|Academic\s*Year)\s*[:\-]?\s*(\d{4}[-\/]\d{2,4})",
        r"(December\s+\d{4}|November\s+\d{4}|May\s+\d{4}|June\s+\d{4})",
    ],
    "exam_shift": [
        r"Time\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:AM|PM)\s*to\s*\d{1,2}:\d{2}\s*(?:AM|PM))",
        r"(?:Shift|Timing)\s*[:\-]?\s*(Morning|Evening|Afternoon|\d{1,2}:\d{2})",
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
                    val = re.sub(r"\s+", " ", val)
                    if field == "semester":
                        if not val.isdigit():
                            try:
                                val = str(_roman_to_int(val))
                            except Exception:
                                pass
                    if len(val) >= 2 or field == "semester":
                        fields[field] = val
                        break
            except Exception:
                continue

    if "semester" not in fields:
        _RL = {"VIII":8,"VII":7,"VI":6,"V":5,"IV":4,"III":3,"II":2,"I":1}
        _sm = re.search(
            r"(?:Sem[a-z.]{0,8})\s*[:\-]?\s*(VIII|VII|VI|V|IV|III|II|I|[1-8])(?![A-Za-z\d])",
            text, re.IGNORECASE)
        if _sm:
            _sv = _sm.group(1).upper().strip()
            fields["semester"] = str(_RL[_sv]) if _sv in _RL else _sv
            print("[OCR] Semester extracted: " + fields["semester"])

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

    # ── OCR substitution fixing for enrollment number ──────────────────────
    # Tesseract commonly swaps: 1↔I, 0↔O, 8↔B, 5↔S, 2↔Z, 6↔G
    # Try to recover a valid RGPV enrollment if the raw match looks close
    RGPV_PATTERN = re.compile(r'\b\d{4}[A-Z]{2}\d{6}\b')

    def fix_enrollment(raw):
        digit_map = {'I':'1','O':'0','B':'8','S':'5','Z':'2','G':'6','l':'1','o':'0'}
        letter_map = {'1':'L','0':'O','8':'B','5':'S','2':'Z','6':'G'}
        raw = re.sub(r'[.\-\s ]', '', raw)
        if len(raw) < 12:
            return raw
        result = list(raw.upper()[:12])
        for i in range(0, 4):
            if not result[i].isdigit():
                result[i] = digit_map.get(result[i], result[i])
        for i in range(4, 6):
            if result[i].isdigit():
                result[i] = letter_map.get(result[i], result[i])
            elif not result[i].isalpha():
                result[i] = 'X'
        for i in range(6, 12):
            if not result[i].isdigit():
                result[i] = digit_map.get(result[i], result[i])
        return ''.join(result)

    if 'roll_number' in fields:
        raw_enroll = fields['roll_number']
        if not RGPV_PATTERN.match(raw_enroll):
            fixed = fix_enrollment(raw_enroll)
            if RGPV_PATTERN.match(fixed):
                print('[OCR] Enrollment corrected: ' + raw_enroll + ' -> ' + fixed)
                fields['roll_number'] = fixed

    if True:  # Always try institute prefix reconstruction
        candidates = re.findall(r'[A-Z0-9][A-Z0-9.\- ]{10,15}', upper_text)
        for cand in candidates:
            fixed = fix_enrollment(cand)
            if RGPV_PATTERN.match(fixed):
                print('[OCR] Enrollment found: ' + cand + ' -> ' + fixed)
                fields['roll_number'] = fixed
                break


    # Fast path: 0818 is fixed institute prefix, try all known branch codes
    KNOWN_BRANCHES = ['CL', 'CS', 'DS', 'EC']
    if True:  # Always try institute prefix reconstruction
        # Find 6-digit sequences in raw text
        six_digits = re.findall(r'\d{6}', upper_text)
        if not six_digits:
            cleaned = re.sub(r'[^A-Z0-9]', '', upper_text)
            six_digits = re.findall(r'\d{6}', cleaned)
        for suffix in six_digits:
            for branch in KNOWN_BRANCHES:
                candidate = '0818' + branch + suffix
                if RGPV_PATTERN.match(candidate):
                    print('[OCR] Enrollment candidate: ' + candidate)
                    # Store all candidates, first one wins for now
                    if True:  # Always prefer reconstructed
                        fields['roll_number'] = candidate
                        fields['roll_number_candidates'] = [
                            '0818' + b + suffix for b in KNOWN_BRANCHES
                        ]
                    break
            if 'roll_number' in fields:
                break

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

    # Try all branch candidates if available
    candidates = ocr_fields.get('roll_number_candidates', [])
    for cand in candidates:
        if cand.upper() == target:
            return 1.0
        s = _similarity(target, cand)
        if s > best:
            best = s

    # Try all branch candidates if available
    candidates = ocr_fields.get('roll_number_candidates', [])
    for cand in candidates:
        if cand.upper() == target:
            return 1.0
        s = _similarity(target, cand)
        if s > best:
            best = s

    return max(field_score, best)


def score_name_match(db_name: str, ocr_fields: dict, raw_text: str = "") -> float:
    """Fuzzy name match tolerating OCR errors, missing labels, and partial names."""
    db_name_clean = db_name.upper().strip()
    ocr_name = ocr_fields.get("student_name", "").upper().strip()

    # Exact or fuzzy match on the extracted name field
    field_score = 0.0
    if ocr_name:
        def token_sort(s):
            return " ".join(sorted(s.split()))
        field_score = _similarity(token_sort(db_name_clean), token_sort(ocr_name))
        db_parts_field = [p for p in db_name_clean.split() if len(p) > 2]
        hit_count_field = sum(1 for p in db_parts_field if p in ocr_name)
        partial_field = (hit_count_field / len(db_parts_field)) * 0.9 if db_parts_field else 0.0
        field_score = max(field_score, partial_field)

    # Raw text keyword overlap check (extremely useful for ID cards without "Name:" labels)
    raw_score = 0.0
    if raw_text:
        raw_upper = raw_text.upper()
        db_parts_raw = [p for p in db_name_clean.split() if len(p) > 2]
        if db_parts_raw:
            hit_count_raw = sum(1 for p in db_parts_raw if p in raw_upper)
            raw_score = hit_count_raw / len(db_parts_raw)

    return max(field_score, raw_score)


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


def score_branch_match(db_branch: str, ocr_branch: str) -> float:
    """
    Fuzzy matching for engineering branch names, mapping abbreviations (e.g. AI, ML, CS, IT) 
    to their full names (e.g. Artificial Intelligence, Machine Learning, Computer Science, etc.).
    """
    if not db_branch or not ocr_branch:
        return 0.0
    db_clean = db_branch.upper().strip()
    ocr_clean = ocr_branch.upper().strip()
    
    if db_clean == ocr_clean:
        return 1.0
        
    sim = _similarity(db_clean, ocr_clean)
    if sim > 0.6:
        return sim
        
    # Common mappings for branches
    mappings = {
        "AI": ["ARTIFICIAL", "INTELLIGENCE"],
        "ML": ["MACHINE", "LEARNING"],
        "CS": ["COMPUTER", "SCIENCE"],
        "IT": ["INFORMATION", "TECHNOLOGY"],
        "EC": ["ELECTRONICS", "COMMUNICATION"],
        "ME": ["MECHANICAL"],
        "CE": ["CIVIL"]
    }
    
    for abbr, words in mappings.items():
        if abbr in db_clean:
            if any(w in ocr_clean for w in words):
                return 0.85
        if any(w in db_clean for w in words):
            if abbr in ocr_clean or any(w in ocr_clean for w in words):
                return 0.85
                
    return sim