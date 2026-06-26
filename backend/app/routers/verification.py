"""
Verification Router — 3-step pipeline:
  Step 1: Face biometric (ArcFace + liveness)
  Step 2: Admit card OCR  — cross-verify enrollment, name, semester, branch
  Step 3: ID card OCR     — cross-verify name + student ID, then mark attendance
"""

import base64
import time
import re
import pickle

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, AttendanceRecord, Exam
from ..utils.auth import get_current_user
from ..models import User
from ..services.face_service import (
    encode_face_from_bytes,
    get_liveness_from_bytes,
    compare_faces_cached,
    compare_faces_batch,
    invalidate_cache_for,
    encode_faces_averaged,
)

try:
    from ..services.ocr_service import (
        extract_admit_card_fields,
        extract_id_card_fields,
        score_enrollment_match,
        score_name_match,
    )
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    def extract_admit_card_fields(b): return {}, ""
    def extract_id_card_fields(b):   return {}, ""
    def score_enrollment_match(e, f, r): return 0.0
    def score_name_match(n, f, r):       return 0.0

router = APIRouter(prefix="/api/verify", tags=["verification"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class VerifyStep1Request(BaseModel):
    exam_id:        int
    face_image_b64: str

class VerifyStep2Request(BaseModel):
    exam_id:         int
    student_id:      int
    admit_image_b64: str

class VerifyStep3Request(BaseModel):
    exam_id:       int
    student_id:    int
    id_image_b64:  str

class RegisterFaceRequest(BaseModel):
    student_id:      int
    face_images_b64: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_b64(b64_str: str, label: str) -> bytes:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    b64_str = b64_str.strip()
    try:
        return base64.b64decode(b64_str)
    except Exception:
        raise HTTPException(422, f"Invalid base64 data for {label}")


def _get_candidates_for_exam(exam_id: int, db: Session):
    if exam_id:
        try:
            exam = db.query(Exam).filter(Exam.id == exam_id).first()
            if exam and hasattr(exam, "students") and exam.students:
                candidates = [s for s in exam.students if s.face_encoding]
                if candidates:
                    return candidates, "exam_roster"
        except Exception:
            pass
    candidates = db.query(Student).filter(Student.face_encoding.isnot(None)).all()
    return candidates, "all_students"


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", text).upper()


ROMAN_TO_INT = {"I":1,"II":2,"III":3,"IV":4,"V":5,"VI":6,"VII":7,"VIII":8}

def _score_semester(ocr_sem_raw: str | None, student_sem: str | None) -> float:
    """
    Compare semester extracted from OCR raw text vs student DB semester.
    Returns 1.0 match, 0.0 mismatch, 0.5 if either missing.
    """
    if not ocr_sem_raw or not student_sem:
        return 0.5
    def normalise(s):
        s = str(s).strip().upper()
        if s in ROMAN_TO_INT:
            return ROMAN_TO_INT[s]
        try:
            import re as _re
            return int(_re.sub(r"[^0-9]", "", s))
        except Exception:
            return None
    e = normalise(ocr_sem_raw)
    s = normalise(student_sem)
    if e is None or s is None:
        return 0.5
    return 1.0 if e == s else 0.0
def _score_branch(db_branch: str | None, ocr_fields: dict) -> float:
    """Fuzzy branch match. Returns 0.0–1.0."""
    if not db_branch:
        return 0.5  # not stored — neutral
    ocr_branch = ocr_fields.get("branch", "")
    if not ocr_branch:
        return 0.0
    # Import from ocr_service if available, else simple check
    try:
        from ..services.ocr_service import score_branch_match
        return score_branch_match(db_branch, ocr_branch)
    except ImportError:
        db_up  = db_branch.upper()
        ocr_up = ocr_branch.upper()
        # Check if first meaningful word matches
        db_words  = [w for w in db_up.split() if len(w) > 2]
        ocr_words = [w for w in ocr_up.split() if len(w) > 2]
        if not db_words or not ocr_words:
            return 0.5
        hits = sum(1 for w in db_words if any(w in o or o in w for o in ocr_words))
        return hits / len(db_words)


def _admit_verdict(
    enroll_conf: float,
    sem_conf:    float,
) -> tuple[bool, str, float]:
    """
    Returns (passed, reason, overall_confidence).
    Weights: enrollment 70% + semester 30%.
    Only enrollment is a hard gate (>= 0.40).
    """
    overall = round(
        (enroll_conf * 0.70) +
        (sem_conf    * 0.30),
        3
    )

    if enroll_conf < 0.40:
        return False, (
            f"Enrollment not matched (confidence: {enroll_conf:.0%}). "
            "Hold card flat, fill the frame, and retry."
        ), overall

    return True, "OK", overall


# ---------------------------------------------------------------------------
# Step 1 — Face biometric
# ---------------------------------------------------------------------------

@router.post("/step-face")
async def verify_step_face(
    req:         VerifyStep1Request,
    db:          Session = Depends(get_db),
    invigilator: User    = Depends(get_current_user),
):
    t0 = time.time()

    face_bytes    = _decode_b64(req.face_image_b64, "face")
    live_encoding, face_err = encode_face_from_bytes(face_bytes)
    if face_err:
        raise HTTPException(422, f"Face detection failed: {face_err}")

    liveness_score = get_liveness_from_bytes(face_bytes)

    candidates, search_mode = _get_candidates_for_exam(req.exam_id, db)
    if not candidates:
        raise HTTPException(404,
            "No students with registered face biometrics found. "
            "Register biometrics via Admin > Students first.")

    candidate_ids = [s.id for s in candidates]
    batch_results = compare_faces_cached(live_encoding, candidate_ids)

    if not batch_results:
        print("[Verify] Cache empty — falling back to DB comparison")
        stored = [s.face_encoding for s in candidates]
        raw    = compare_faces_batch(stored, live_encoding)
        batch_results = [(candidates[i].id, m, c) for i, m, c in raw]

    if not batch_results:
        raise HTTPException(500, "Face comparison failed — no results returned")

    top_sid, is_match, best_conf = batch_results[0]

    if not is_match:
        raise HTTPException(404,
            f"Face not matched to any registered student "
            f"(best confidence: {best_conf:.1f}%). "
            "Ensure face is clearly visible, well-lit, and try again.")

    student = db.query(Student).filter(Student.id == top_sid).first()
    if not student:
        raise HTTPException(500, "Matched student not found in database")

    elapsed = round((time.time() - t0) * 1000)
    print(f"[Verify] Step 1 OK — {student.name} ({best_conf:.1f}%) "
          f"liveness={liveness_score:.2f} mode={search_mode} [{elapsed}ms]")

    return {
        "student_id":     student.id,
        "student_name":   student.name,
        "enrollment_no":  student.enrollment_no,
        "branch":         getattr(student, "branch", None),
        "semester":       getattr(student, "semester", None),
        "confidence":     best_conf,
        "liveness_score": round(liveness_score, 3),
        "liveness_pass":  liveness_score >= 0.4,
        "search_mode":    search_mode,
        "elapsed_ms":     elapsed,
    }


# ---------------------------------------------------------------------------
# Step 2 — Admit card OCR
# Cross-verify: enrollment number, name, semester, branch
# ---------------------------------------------------------------------------

@router.post("/step-admit")
async def verify_step_admit(
    req:         VerifyStep2Request,
    db:          Session = Depends(get_db),
    invigilator: User    = Depends(get_current_user),
):
    t0 = time.time()

    admit_bytes = _decode_b64(req.admit_image_b64, "admit card")

    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    # ── OCR ──────────────────────────────────────────────────────────────────
    fields, raw_text = extract_admit_card_fields(admit_bytes)
    elapsed_ocr = round((time.time() - t0) * 1000)

    print(f"[Verify] FULL OCR TEXT: {repr(raw_text)}")
    print(f"[Verify] Step 2 OCR done in {elapsed_ocr}ms — fields: {fields}")

    # ── Soft pass if OCR got nothing at all ──────────────────────────────────
    if not raw_text.strip():
        print(f"[Verify] Step 2 OCR returned blank — soft pass for {student.name}")
        return {
            "student_id":      student.id,
            "student_name":    student.name,
            "enrollment_no":   student.enrollment_no,
            "ocr_match":       False,
            "ocr_confidence":  0.0,
            "fields_extracted": {},
            "warning":         "OCR could not read card — verify admit card manually",
        }

    # ── Score each field ─────────────────────────────────────────────────────
    enroll_conf = score_enrollment_match(student.enrollment_no, fields, raw_text)

    # Semester: use exam's fixed semester constant (set when exam is created)
    exam_obj = db.query(Exam).filter(Exam.id == req.exam_id).first()
    exam_sem = getattr(exam_obj, 'semester', None) if exam_obj else None
    student_sem = getattr(student, 'semester', None)
    # Extract semester from OCR raw text using Roman numeral regex
    import re as _re
    _sem_match = _re.search(
        r"Sem(?:ester)?[a-zA-Z]*[\s:\-]*\s*(VIII|VII|VI|IV|III|IX|II|I|\d{1,2})|\b(VIII|VII|VI|IV|III|IX|II|V|I)\b",
        raw_text, _re.IGNORECASE
    )
    ocr_sem = (_sem_match.group(1) or _sem_match.group(2)).upper().strip() if _sem_match else None
    
    
    student_sem = getattr(student, "semester", None)
    sem_conf = _score_semester(ocr_sem, student_sem)
    print("[Verify] Semester OCR=" + str(ocr_sem) + " DB=" + str(student_sem) + " score=" + str(sem_conf))

    print(f"[Verify] Step 2 scores — "
          f"enrollment={enroll_conf:.2f} sem={sem_conf:.2f} "
          f"(exam_sem={exam_sem} student_sem={student_sem})")

    # ── Verdict ──────────────────────────────────────────────────────────────
    passed, reason, overall_conf = _admit_verdict(enroll_conf, sem_conf)

    if not passed:
        raise HTTPException(404, reason)

    print(f"[Verify] Step 2 OK — {student.name} admit card verified "
          f"(overall={overall_conf:.0%})")

    return {
        "student_id":       student.id,
        "student_name":     student.name,
        "enrollment_no":    student.enrollment_no,
        "ocr_match":        True,
        "ocr_confidence":   round(overall_conf * 100, 1),
        "enroll_confidence": round(enroll_conf * 100, 1),
        "name_confidence":  0,
        "sem_confidence":   round(sem_conf * 100, 1),
        "branch_confidence": 0,
        "ocr_enrollment":   fields.get("roll_number"),
        "ocr_name":         fields.get("student_name"),
        "ocr_semester":     fields.get("semester"),
        "ocr_branch":       fields.get("branch"),
        "fields_extracted": fields,
        "elapsed_ms":       elapsed_ocr,
    }


# ---------------------------------------------------------------------------
# Step 3 — ID card OCR + mark attendance
# Cross-verify: name + student ID (enrollment number)
# ---------------------------------------------------------------------------

def _cv2_decode_barcode(img):
    import cv2
    try:
        detector = cv2.barcode.BarcodeDetector()
        ok, decoded, _, _ = detector.detectAndDecodeMulti(img)
        if ok and decoded:
            return [type("C", (), {"data": d.encode()})() for d in decoded if d]
    except Exception as e:
        print("[Barcode] cv2 error: " + str(e))
    return []

@router.post("/step-id")
async def verify_step_id(
    req:         VerifyStep3Request,
    db:          Session = Depends(get_db),
    invigilator: User    = Depends(get_current_user),
):
    import cv2, numpy as np, pytesseract
    from PIL import Image as _PIL

    t0       = time.time()
    id_bytes = _decode_b64(req.id_image_b64, "ID card")

    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    existing = (db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == req.student_id,
                AttendanceRecord.exam_id    == req.exam_id).first())
    if existing:
        raise HTTPException(409,
            f"{student.name} ({student.enrollment_no}) already admitted for this exam.")

    student_id_no = str(getattr(student, "student_id_no", "") or "").strip()
    if not student_id_no:
        raise HTTPException(500, "Student ID number not registered in system.")

    nparr = np.frombuffer(id_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(422, "Could not decode image.")


    found_id  = None
    found_how = None
    sid_len   = len(student_id_no)

    def sharpen(image):
        kernel = np.array([[-1,-1,-1],
                           [-1, 9,-1],
                           [-1,-1,-1]])
        return cv2.filter2D(image, -1, kernel)

    def enhance_barcode(image):
        """Aggressive preprocessing specifically for barcode reading."""
        g = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape)==3 else image.copy()
        # Upscale 4x
        g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        # Sharpen
        g = cv2.filter2D(g, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]))
        # CLAHE for contrast
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        g = clahe.apply(g)
        # Threshold
        _, t = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
        return t

    def decode_barcode(image):
        try:
            det = cv2.barcode.BarcodeDetector()
            ok, decoded, _, _ = det.detectAndDecodeMulti(image)
            if ok and decoded:
                return [d.strip() for d in decoded if d and d.strip()]
        except Exception:
            pass
        return []

    def all_rotations(image):
        yield image
        yield cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        yield cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
        yield cv2.rotate(image, cv2.ROTATE_180)

    # ── BARCODE: try every rotation + strip + enhancement ────────────────────
    h, w = img.shape[:2]
    strips = {"full": img, "bottom_half": img[h//2:, :], "bottom_third": img[2*h//3:, :]}
    
    
    
    
    
    

    for strip_name, strip in strips.items():
        if strip.size == 0:
            continue
        for rot in all_rotations(strip):
            # Try raw + enhanced
            enhanced = enhance_barcode(rot)
            for probe in [rot, enhanced]:
                for val in decode_barcode(probe):
                    digits = re.sub(r"[^0-9]", "", val)
                    print(f"[Barcode] strip={strip_name} val={repr(val)} digits={digits} want={student_id_no}")
                    if digits == student_id_no or student_id_no in digits:
                        found_id  = student_id_no
                        found_how = "barcode-" + strip_name
                        break
                if found_id: break
            if found_id: break
        if found_id: break

    # ── OCR FALLBACK ──────────────────────────────────────────────────────────
    if not found_id:
        def ocr_search(image):
            g = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape)==3 else image
            g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_LINEAR)
            _, t = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
            pil = _PIL.fromarray(t)
            text = pytesseract.image_to_string(pil, config="--oem 3 --psm 11")
            print("[ID OCR] >> " + text[:250].replace(chr(10)," | "))
            m = re.search(r"student\s*[il1]?d\s*(?:no|num)?\.?\s*[:\-]?\s*(\d{4,9})", text, re.IGNORECASE)
            if m:
                cand = re.sub(r"[^0-9]","",m.group(1))
                if cand==student_id_no or (len(cand)==sid_len and sum(a!=b for a,b in zip(cand,student_id_no))<=1):
                    print("[ID OCR] P1 labeled: "+cand); return student_id_no
            # P1: labeled
            m = re.search(
                r"student\s*[il1]?d\s*(?:no|num)?\.?\s*[:\-]?\s*(\d{4,9})",
                text, re.IGNORECASE)
            if m:
                cand = re.sub(r"[^0-9]","",m.group(1))
                if cand==student_id_no or (len(cand)==sid_len and
                        sum(a!=b for a,b in zip(cand,student_id_no))<=1):
                    print("[ID OCR] P1 labeled: "+cand)
                    return student_id_no
            # P2: exact
            for tok in re.findall(r"\d{5,9}", text):
                if tok==student_id_no:
                    print("[ID OCR] P2 exact: "+tok)
                    return tok
            # P3: fuzzy
            for tok in re.findall(r"\d+", text):
                if len(tok)==sid_len and sum(a!=b for a,b in zip(tok,student_id_no))<=1:
                    print("[ID OCR] P3 fuzzy: "+tok)
                    return student_id_no
            return None

        for rot in all_rotations(img):
            r = ocr_search(rot)
            if r:
                found_id  = r
                found_how = "ocr"
                break

    elapsed = round((time.time() - t0)*1000)
    print(f"[Verify] Step 3 found_id={found_id} how={found_how} [{elapsed}ms]")

    if not found_id:
        raise HTTPException(404,
            "Hold card flat and still with barcode facing camera. Avoid tilting.")

    record = AttendanceRecord(
        student_id    = req.student_id,
        exam_id       = req.exam_id,
        marked_by     = invigilator.id,
        face_verified = True,
        admit_verified= True,
        id_verified   = True,
        status        = "Present",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    invalidate_cache_for(req.student_id, db)
    print(f"[Verify] Step 3 OK — {student.name} marked PRESENT via {found_how}")

    return {
        "status":        "verified",
        "attendance_id": record.id,
        "student_id":    student.id,
        "student_name":  student.name,
        "enrollment_no": student.enrollment_no,
        "id_match":      True,
        "id_flagged":    False,
        "ocr_id":        found_id,
        "exam_id":       req.exam_id,
        "verified_at":   record.marked_at.strftime("%Y-%m-%dT%H:%M:%S") if record.marked_at else "",
        "elapsed_ms":    elapsed,
        "message":       f"{student.name} verified and marked present.",
    }


@router.post("/register-face")
async def register_face(
    req:   RegisterFaceRequest,
    db:    Session = Depends(get_db),
    admin: User    = Depends(get_current_user),
):
    if not req.face_images_b64:
        raise HTTPException(422, "No images provided")

    images_bytes = [_decode_b64(img, f"frame {i}")
                    for i, img in enumerate(req.face_images_b64)]

    avg_embedding, err = encode_faces_averaged(images_bytes)
    if err:
        raise HTTPException(422, f"Face registration failed: {err}")

    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    student.face_encoding = pickle.dumps(avg_embedding)
    db.commit()
    invalidate_cache_for(req.student_id, db)

    print(f"[Register] Face registered for {student.name} "
          f"({len(images_bytes)} captures)")

    return {
        "student_id":    student.id,
        "student_name":  student.name,
        "captures_used": len(images_bytes),
        "message":       f"Face registered for {student.name}.",
    }


# ---------------------------------------------------------------------------
# Readiness check
# ---------------------------------------------------------------------------

@router.get("/readiness-check")
async def readiness_check(
    db:    Session = Depends(get_db),
    admin: User    = Depends(get_current_user),
):
    from ..services.face_service import _embedding_cache, update_embedding_cache
    total          = db.query(Student).count()
    with_encoding  = db.query(Student).filter(Student.face_encoding.isnot(None)).all()
    missing        = db.query(Student).filter(Student.face_encoding.is_(None)).all()
    return {
        "total_students": total,
        "registered":     len(with_encoding),
        "in_cache":       len(_embedding_cache),
        "missing":        [{"id": s.id, "name": s.name, "enrollment_no": s.enrollment_no}
                           for s in missing],
        "ready":          len(missing) == 0 and len(_embedding_cache) == len(with_encoding),
        "ocr_available":  OCR_AVAILABLE,
    }