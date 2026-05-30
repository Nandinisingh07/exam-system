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


def preprocess_for_ocr(image_bytes: bytes) -> list:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return [(image_bytes, "original")]
    img = _deskew(img)
    h, w = img.shape[:2]
    scale = min(2.0, 1500 / w) if w < 1500 else 1.0
    if scale != 1.0:
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    print("[OCR] Size: {}x{}".format(img.shape[1], img.shape[0]))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    results = []
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    _, t1 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, b1 = cv2.imencode(".png", t1)
    results.append((b1.tobytes(), "clahe_otsu"))
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    t2 = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10)
    _, b2 = cv2.imencode(".png", t2)
    results.append((b2.tobytes(), "adaptive"))
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    _, t3 = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, b3 = cv2.imencode(".png", t3)
    results.append((b3.tobytes(), "sharpen_otsu"))
    _, b4 = cv2.imencode(".png", gray)
    results.append((b4.tobytes(), "gray_raw"))
    try:
        cv2.imwrite(r"C:/Users/Nandini singh/Desktop/ocr_debug.png", t1)
    except Exception:
        pass
    return results
def extract_raw_text(image_bytes: bytes) -> str:
    WL = "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-: "
    configs = ["--oem 3 --psm 6 " + WL, "--oem 3 --psm 4 " + WL, "--oem 3 --psm 11 " + WL]
    ENROLL_RE = re.compile(r"[0-9]{4}[A-Za-z]{2}[0-9]{6}")
    def score_text(t):
        s = 0
        if re.search(r"[0-9]{4}", t): s += 3
        if re.search(r"[A-Z]{2,4}[0-9]{6,12}", t): s += 5
        if ENROLL_RE.search(t): s += 10
        s += min(len(t) / 100, 3)
        return s
    best_text = ""
    best_score = -1
    try:
        variants = preprocess_for_ocr(image_bytes)
        for img_bytes, label in variants:
            image = Image.open(io.BytesIO(img_bytes))
            for cfg in configs:
                try:
                    t = pytesseract.image_to_string(image, config=cfg).strip()
                    sc = score_text(t)
                    print("[OCR] {}/{} score={} preview={}".format(label, cfg[10:12], sc, repr(t[:60])))
                    if sc > best_score:
                        best_score = sc
                        best_text = t
                        if ENROLL_RE.search(t):
                            print("[OCR] Enrollment found in " + label)
                            return t
                except Exception as e:
                    print("[OCR] {} failed: {}".format(label, e))
    except Exception as e:
        print("[OCR] error: " + str(e))
    return best_text




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
    if field_score > 0.75:
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
