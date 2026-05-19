"""
Verification Router — Full 3-step intelligent pipeline.
  Step 1: Live face encoding + liveness
  Step 2: Admit card OCR field extraction + scoring
  Step 3: ID card cross-match scoring
  Step 4: Confidence engine → Auto-Approve / Manual-Review / Reject
  Step 5: Attendance record + fraud checks
"""
import base64
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, AttendanceRecord, User, Exam, SeatAllocation
from ..models.attendance import ManualReviewQueue, FraudAlert
from ..utils.auth import get_current_user
from ..services.face_service import (
    encode_face_from_bytes, compare_faces, get_liveness_from_bytes
)
from ..services.ocr_service import (
    extract_admit_card_fields, extract_id_card_fields,
    score_enrollment_match, score_name_match, score_father_name_match,
)
from ..services.confidence_engine import compute_confidence
from ..config import settings
from ..utils import metrics

router = APIRouter(prefix="/api/verify", tags=["verification"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class VerifyRequest(BaseModel):
    exam_id:        int
    face_image_b64: str
    admit_card_b64: str
    id_card_b64:    str

class VerifyStep1Request(BaseModel):
    exam_id: int
    face_image_b64: str

class VerifyStep2Request(BaseModel):
    student_id: int
    admit_card_b64: str

class VerifyStep3Request(BaseModel):
    exam_id: int
    student_id: int
    id_card_b64: str
    face_score: float
    liveness_score: float
    enrollment_score: float
    name_score: float
    father_name_score: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_b64(b64_str: str, field_name: str) -> bytes:
    try:
        return base64.b64decode(b64_str.split(",")[-1])
    except Exception:
        raise HTTPException(400, f"Corrupt {field_name} image data.")


def _log_fraud(student_id, exam_id, alert_type, details, severity, db):
    try:
        alert = FraudAlert(
            student_id=student_id,
            exam_id=exam_id,
            alert_type=alert_type,
            details=details,
            severity=severity,
        )
        db.add(alert)
    except Exception as e:
        print(f"[Fraud] log error: {e}")


def _send_to_manual_review(student_id, exam_id, enrollment_detected,
                            face_score, ocr_score, id_score,
                            final_confidence, reason, db):
    entry = ManualReviewQueue(
        student_id=student_id,
        exam_id=exam_id,
        enrollment_detected=enrollment_detected,
        face_score=face_score,
        ocr_score=ocr_score,
        id_score=id_score,
        final_confidence=final_confidence,
        reason=reason,
    )
    db.add(entry)


# ---------------------------------------------------------------------------
# Main verification endpoint
# ---------------------------------------------------------------------------

@router.post("/student")
async def verify_student(
    req: VerifyRequest,
    db: Session = Depends(get_db),
    invigilator: User = Depends(get_current_user),
):
    metrics.VERIFICATIONS_TOTAL.inc()
    start_ts = time.time()

    # ── 0. Decode inputs ────────────────────────────────────────────────────
    face_bytes  = _decode_b64(req.face_image_b64, "face")
    admit_bytes = _decode_b64(req.admit_card_b64, "admit card")
    id_bytes    = _decode_b64(req.id_card_b64,    "ID card")

    # ── 1. Face encoding + liveness ─────────────────────────────────────────
    live_encoding, face_err = encode_face_from_bytes(face_bytes)
    if face_err:
        raise HTTPException(422, f"Face error: {face_err}")

    liveness_score = get_liveness_from_bytes(face_bytes)

    # ── 2. OCR — Admit card ─────────────────────────────────────────────────
    admit_fields, admit_raw = extract_admit_card_fields(admit_bytes)

    if not admit_raw or len(admit_raw.strip()) < 10:
        raise HTTPException(422, "Admit card image unreadable — too blurry or covered.")

    enrollment_detected = admit_fields.get("roll_number")
    if not enrollment_detected:
        raise HTTPException(422, "Could not detect enrollment/roll number on admit card.")

    # ── 3. Database lookup ──────────────────────────────────────────────────
    student = db.query(Student).filter(
        Student.enrollment_no == enrollment_detected.upper()
    ).first()

    # Fuzzy fallback: scan students allocated to this exam
    if not student:
        allocated = (
            db.query(Student)
            .join(SeatAllocation, SeatAllocation.student_id == Student.id)
            .filter(SeatAllocation.exam_id == req.exam_id)
            .all()
        )
        best_score = 0.0
        for s in allocated:
            sc = score_enrollment_match(s.enrollment_no, admit_fields, admit_raw)
            if sc > best_score:
                best_score = sc
                student = s
        if best_score < 0.75:
            student = None

    if not student:
        metrics.VERIFICATION_FAILURES_TOTAL.inc()
        raise HTTPException(
            404,
            f"No student with enrollment '{enrollment_detected}' found in exam roster."
        )

    # Eligibility gate
    if not student.is_eligible or student.fee_status != "paid":
        _log_fraud(student.id, req.exam_id, "ineligible_student",
                   f"fee_status={student.fee_status}, eligible={student.is_eligible}",
                   "high", db)
        db.commit()
        raise HTTPException(403, "Student is ineligible for this exam (fee pending or barred).")

    # Duplicate entry gate
    existing_attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.exam_id == req.exam_id,
        AttendanceRecord.status == "Present",
    ).first()
    if existing_attendance:
        student.attempt_count = (student.attempt_count or 0) + 1
        _log_fraud(student.id, req.exam_id, "duplicate_entry",
                   f"attempt #{student.attempt_count}", "critical", db)
        db.commit()
        raise HTTPException(409, f"Student already verified and marked present for this exam.")

    # ── 4. Score OCR fields against DB record ───────────────────────────────
    enroll_score  = score_enrollment_match(student.enrollment_no, admit_fields, admit_raw)
    name_score    = score_name_match(student.name, admit_fields)
    father_score  = score_father_name_match(student.father_name or "", admit_fields)

    # ── 5. OCR — ID card cross-match ────────────────────────────────────────
    id_fields, id_raw = extract_id_card_fields(id_bytes)
    id_enroll_score = score_enrollment_match(student.enrollment_no, id_fields, id_raw)
    id_name_score   = score_name_match(student.name, id_fields)
    id_score = min((id_enroll_score * 0.6 + id_name_score * 0.4), 1.0)

    # ── 6. Face biometric match ─────────────────────────────────────────────
    if not student.face_encoding:
        raise HTTPException(
            400,
            "Student biometrics not registered. Please contact admin to complete registration."
        )

    is_face_match, face_confidence, comp_err = compare_faces(student.face_encoding, live_encoding)
    if comp_err:
        raise HTTPException(500, f"Biometric engine error: {comp_err}")

    # ── 7. Confidence engine ────────────────────────────────────────────────
    result = compute_confidence(
        face_score       = face_confidence,
        enrollment_score = enroll_score,
        name_score       = name_score,
        father_name_score= father_score,
        id_score         = id_score,
        liveness_score   = liveness_score,
    )

    final_conf = result["final_confidence"]
    decision   = result["decision"]

    processing_ms = int((time.time() - start_ts) * 1000)

    # ── 8. Act on decision ──────────────────────────────────────────────────
    if decision == "REJECT":
        metrics.VERIFICATION_FAILURES_TOTAL.inc()
        student.attempt_count = (student.attempt_count or 0) + 1
        db.commit()
        raise HTTPException(
            403,
            f"{result['reason']} (Confidence: {final_conf}%)"
        )

    if decision == "MANUAL_REVIEW":
        _send_to_manual_review(
            student_id=student.id,
            exam_id=req.exam_id,
            enrollment_detected=enrollment_detected,
            face_score=face_confidence,
            ocr_score=round(enroll_score * 100, 2),
            id_score=round(id_score * 100, 2),
            final_confidence=final_conf,
            reason=result["reason"],
            db=db,
        )
        db.commit()
        return {
            "verified":          False,
            "decision":          "MANUAL_REVIEW",
            "student_name":      student.name,
            "enrollment_no":     student.enrollment_no,
            "final_confidence":  final_conf,
            "reason":            result["reason"],
            "component_scores":  result["component_scores"],
            "processing_time_ms":processing_ms,
            "message": "Case sent to invigilator for manual review.",
        }

    # AUTO_APPROVE — mark attendance
    allocation = db.query(SeatAllocation).filter(
        SeatAllocation.student_id == student.id,
        SeatAllocation.exam_id   == req.exam_id,
    ).first()

    attendance = AttendanceRecord(
        student_id      = student.id,
        exam_id         = req.exam_id,
        marked_by       = invigilator.id,
        face_verified   = is_face_match,
        admit_verified  = True,
        id_verified     = True,
        face_score      = face_confidence,
        ocr_score       = round(enroll_score * 100, 2),
        id_score        = round(id_score * 100, 2),
        liveness_score  = round(liveness_score * 100, 2),
        final_confidence= final_conf,
        decision        = decision,
        status          = "Present",
        processing_time_ms = processing_ms,
    )
    db.add(attendance)
    student.attempt_count = (student.attempt_count or 0) + 1
    db.commit()

    return {
        "verified":          True,
        "decision":          "AUTO_APPROVE",
        "student_name":      student.name,
        "enrollment_no":     student.enrollment_no,
        "branch":            student.class_name,
        "semester":          student.semester,
        "father_name":       student.father_name or "",
        "centre_code":       student.centre_code or "",
        "final_confidence":  final_conf,
        "component_scores":  result["component_scores"],
        "room":  allocation.classroom.room_number if allocation and allocation.classroom else "N/A",
        "seat":  allocation.seat_number if allocation else "N/A",
        "processing_time_ms": processing_ms,
        "message": "✅ Access Granted. Attendance recorded automatically.",
    }


# ---------------------------------------------------------------------------
# Step-by-Step Verification Endpoints
# ---------------------------------------------------------------------------

@router.post("/step-face")
async def verify_step_face(
    req: VerifyStep1Request,
    db: Session = Depends(get_db),
    invigilator: User = Depends(get_current_user),
):
    face_bytes = _decode_b64(req.face_image_b64, "face")
    live_encoding, face_err = encode_face_from_bytes(face_bytes)
    if face_err:
        raise HTTPException(422, f"Face error: {face_err}")

    liveness_score = get_liveness_from_bytes(face_bytes)
    
    # Check all students in the exam for a face match
    allocated_students = (
        db.query(Student)
        .join(SeatAllocation, SeatAllocation.student_id == Student.id)
        .filter(SeatAllocation.exam_id == req.exam_id)
        .all()
    )
    
    best_student = None
    best_conf = 0.0
    
    for s in allocated_students:
        if s.face_encoding:
            is_match, conf, err = compare_faces(s.face_encoding, live_encoding)
            if is_match and conf > best_conf:
                best_student = s
                best_conf = conf

    if not best_student or best_conf < 50.0:
        raise HTTPException(404, "Face not matched to any registered student in this exam.")

    return {
        "success": True,
        "student_id": best_student.id,
        "student_name": best_student.name,
        "enrollment_no": best_student.enrollment_no,
        "face_score": best_conf,
        "liveness_score": liveness_score,
        "message": f"Face matched: {best_student.name} ({best_conf}%)"
    }

@router.post("/step-admit")
async def verify_step_admit(
    req: VerifyStep2Request,
    db: Session = Depends(get_db),
    invigilator: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found.")

    admit_bytes = _decode_b64(req.admit_card_b64, "admit card")
    admit_fields, admit_raw = extract_admit_card_fields(admit_bytes)

    if not admit_raw or len(admit_raw.strip()) < 10:
        raise HTTPException(422, "Admit card image unreadable — too blurry or covered.")

    enroll_score  = score_enrollment_match(student.enrollment_no, admit_fields, admit_raw)
    name_score    = score_name_match(student.name, admit_fields)
    father_score  = score_father_name_match(student.father_name or "", admit_fields)
    
    if enroll_score < 0.4:
        raise HTTPException(422, "Admit card does not match student enrollment number.")

    return {
        "success": True,
        "enrollment_score": round(enroll_score * 100, 2),
        "name_score": round(name_score * 100, 2),
        "father_name_score": round(father_score * 100, 2),
        "message": "Admit card verified successfully."
    }

@router.post("/step-id")
async def verify_step_id(
    req: VerifyStep3Request,
    db: Session = Depends(get_db),
    invigilator: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found.")
        
    id_bytes = _decode_b64(req.id_card_b64, "ID card")
    id_fields, id_raw = extract_id_card_fields(id_bytes)
    
    id_enroll_score = score_enrollment_match(student.enrollment_no, id_fields, id_raw)
    id_name_score   = score_name_match(student.name, id_fields)
    id_score = min((id_enroll_score * 0.6 + id_name_score * 0.4), 1.0)
    
    # Calculate final confidence
    result = compute_confidence(
        face_score       = req.face_score,
        enrollment_score = req.enrollment_score / 100.0,
        name_score       = req.name_score / 100.0,
        father_name_score= req.father_name_score / 100.0,
        id_score         = id_score,
        liveness_score   = req.liveness_score,
    )
    
    final_conf = result["final_confidence"]
    decision   = result["decision"]
    
    if decision == "REJECT":
        raise HTTPException(403, f"{result['reason']} (Confidence: {final_conf}%)")
        
    if decision == "MANUAL_REVIEW":
        _send_to_manual_review(
            student_id=student.id,
            exam_id=req.exam_id,
            enrollment_detected=student.enrollment_no,
            face_score=req.face_score,
            ocr_score=req.enrollment_score,
            id_score=round(id_score * 100, 2),
            final_confidence=final_conf,
            reason=result["reason"],
            db=db,
        )
        db.commit()
        return {
            "verified": False,
            "decision": "MANUAL_REVIEW",
            "student_name": student.name,
            "final_confidence": final_conf,
            "reason": result["reason"],
            "component_scores": result["component_scores"],
        }
        
    # AUTO_APPROVE — mark attendance
    existing_attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.exam_id == req.exam_id,
        AttendanceRecord.status == "Present",
    ).first()
    if existing_attendance:
        raise HTTPException(409, f"Student already verified and marked present for this exam.")
        
    allocation = db.query(SeatAllocation).filter(
        SeatAllocation.student_id == student.id,
        SeatAllocation.exam_id   == req.exam_id,
    ).first()

    attendance = AttendanceRecord(
        student_id      = student.id,
        exam_id         = req.exam_id,
        marked_by       = invigilator.id,
        face_verified   = True,
        admit_verified  = True,
        id_verified     = True,
        face_score      = req.face_score,
        ocr_score       = req.enrollment_score,
        id_score        = round(id_score * 100, 2),
        liveness_score  = round(req.liveness_score * 100, 2),
        final_confidence= final_conf,
        decision        = decision,
        status          = "Present",
        processing_time_ms = 0,
    )
    db.add(attendance)
    student.attempt_count = (student.attempt_count or 0) + 1
    db.commit()

    return {
        "verified": True,
        "decision": "AUTO_APPROVE",
        "student_name": student.name,
        "enrollment_no": student.enrollment_no,
        "branch": student.class_name,
        "semester": student.semester,
        "father_name": student.father_name or "",
        "final_confidence": final_conf,
        "component_scores": result["component_scores"],
        "room": allocation.classroom.room_number if allocation and allocation.classroom else "N/A",
        "seat": allocation.seat_number if allocation else "N/A",
        "processing_time_ms": 0,
    }


# ---------------------------------------------------------------------------
# Manual review endpoints
# ---------------------------------------------------------------------------

@router.get("/review/queue")
def get_review_queue(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all pending manual review cases."""
    items = db.query(ManualReviewQueue).filter(
        ManualReviewQueue.review_status == "pending"
    ).order_by(ManualReviewQueue.created_at.desc()).all()

    return [
        {
            "id":                  i.id,
            "enrollment_detected": i.enrollment_detected,
            "student_name":        i.student.name if i.student else "Unknown",
            "face_score":          i.face_score,
            "ocr_score":           i.ocr_score,
            "id_score":            i.id_score,
            "final_confidence":    i.final_confidence,
            "reason":              i.reason,
            "created_at":          str(i.created_at),
        }
        for i in items
    ]


@router.post("/review/{review_id}/approve")
def approve_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(ManualReviewQueue).filter(ManualReviewQueue.id == review_id).first()
    if not item:
        raise HTTPException(404, "Review item not found.")

    if item.student_id and item.exam_id:
        attendance = AttendanceRecord(
            student_id    = item.student_id,
            exam_id       = item.exam_id,
            marked_by     = user.id,
            face_verified = True,
            admit_verified= True,
            id_verified   = True,
            face_score    = item.face_score,
            ocr_score     = item.ocr_score,
            id_score      = item.id_score,
            final_confidence = item.final_confidence,
            decision      = "MANUAL_REVIEW_APPROVED",
            status        = "Present",
        )
        db.add(attendance)

    item.review_status = "approved"
    item.reviewed_by   = user.id
    db.commit()
    return {"message": "Student manually approved and attendance recorded."}


@router.post("/review/{review_id}/reject")
def reject_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(ManualReviewQueue).filter(ManualReviewQueue.id == review_id).first()
    if not item:
        raise HTTPException(404, "Review item not found.")
    item.review_status = "rejected"
    item.reviewed_by   = user.id
    db.commit()
    return {"message": "Student rejected by invigilator."}


@router.get("/fraud-alerts")
def get_fraud_alerts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alerts = db.query(FraudAlert).filter(
        FraudAlert.resolved == False
    ).order_by(FraudAlert.created_at.desc()).limit(50).all()

    return [
        {
            "id":         a.id,
            "student":    a.student.name if a.student else "Unknown",
            "enrollment": a.student.enrollment_no if a.student else "—",
            "alert_type": a.alert_type,
            "details":    a.details,
            "severity":   a.severity,
            "created_at": str(a.created_at),
        }
        for a in alerts
    ]