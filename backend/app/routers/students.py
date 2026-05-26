"""
Students Router — Pre-registration with full identity, academic, and exam centre fields.
"""
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.student import Student
from ..models.user import User
from ..utils.auth import require_admin, get_current_user
from ..services.face_service import encode_face_from_bytes, serialize_encoding
from ..config import settings
from ..utils.auth import require_admin, get_current_user, get_current_user
router = APIRouter(prefix="/api/students", tags=["students"])


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/register")
async def register_student(
    # Identity
    name:           str           = Form(...),
    enrollment_no:  str           = Form(...),
    student_id_no:  Optional[str] = Form(None),
    email:          Optional[str] = Form(None),
    phone:          Optional[str] = Form(None),
    father_name:    Optional[str] = Form(None),

    # Academic
    class_name:     str           = Form(...),
    year:           int           = Form(...),
    semester:       int           = Form(...),
    college_name:   Optional[str] = Form(None),

    # Exam Centre
    centre_code:    Optional[str] = Form(None),
    centre_name:    Optional[str] = Form(None),
    practical_centre: Optional[str] = Form(None),
    exam_session:   Optional[str] = Form(None),
    exam_shift:     Optional[str] = Form(None),

    # Security
    fee_status:     Optional[str] = Form("paid"),
    is_eligible:    Optional[bool]= Form(True),

    # Face image
    face_image:     UploadFile    = File(...),

    db:    Session = Depends(get_db),
    admin: User    = Depends(require_admin),
):
    enrollment_no = enrollment_no.upper().strip()

    # Duplicate check
    if db.query(Student).filter(Student.enrollment_no == enrollment_no).first():
        raise HTTPException(400, f"Enrollment number '{enrollment_no}' is already registered.")

    # Face encoding
    image_bytes = await face_image.read()
    encoding, face_err = encode_face_from_bytes(image_bytes)
    if face_err:
        raise HTTPException(400, f"Face registration failed: {face_err}")

    # Save face image
    face_dir = os.path.join(settings.UPLOAD_DIR, "faces")
    os.makedirs(face_dir, exist_ok=True)
    filename = f"{enrollment_no}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(face_dir, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # Create student record
    student = Student(
        name            = name.strip(),
        father_name     = father_name.strip() if father_name else None,
        enrollment_no   = enrollment_no,
        student_id_no   = student_id_no.strip() if student_id_no else None,
        email           = email.strip() if email else None,
        phone           = phone,
        class_name      = class_name,
        year            = year,
        semester        = semester,
        college_name    = college_name,
        centre_code     = centre_code,
        centre_name     = centre_name,
        practical_centre= practical_centre,
        exam_session    = exam_session,
        exam_shift      = exam_shift,
        fee_status      = fee_status or "paid",
        is_eligible     = is_eligible if is_eligible is not None else True,
        face_image_path = filepath,
        face_encoding   = serialize_encoding(encoding),
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return {
        "message":      "Student registered successfully with biometric data.",
        "id":           student.id,
        "enrollment_no":enrollment_no,
        "name":         student.name,
        "face_encoded": True,
    }


# ---------------------------------------------------------------------------
# List students
# ---------------------------------------------------------------------------

@router.get("")
def list_students(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    students = db.query(Student).order_by(Student.registered_at.desc()).all()
    return [_student_dict(s) for s in students]


@router.get("/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found.")
    return _student_dict(s)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found.")
    # Remove face image if present
    if s.face_image_path and os.path.exists(s.face_image_path):
        os.remove(s.face_image_path)
    db.delete(s)
    db.commit()
    return {"message": "Student and biometric data permanently deleted."}


# ---------------------------------------------------------------------------
# Update eligibility / fee status (quick admin patch)
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/eligibility")
def update_eligibility(
    student_id: int,
    is_eligible: bool,
    fee_status: Optional[str] = "paid",
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found.")
    s.is_eligible = is_eligible
    s.fee_status  = fee_status
    db.commit()
    return {"message": "Eligibility updated.", "is_eligible": s.is_eligible, "fee_status": s.fee_status}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _student_dict(s: Student) -> dict:
    return {
        "id":             s.id,
        "name":           s.name,
        "father_name":    s.father_name,
        "enrollment_no":  s.enrollment_no,
        "student_id_no":  s.student_id_no,
        "email":          s.email,
        "phone":          s.phone,
        "class_name":     s.class_name,
        "year":           s.year,
        "semester":       s.semester,
        "college_name":   s.college_name,
        "centre_code":    s.centre_code,
        "centre_name":    s.centre_name,
        "exam_session":   s.exam_session,
        "exam_shift":     s.exam_shift,
        "fee_status":     s.fee_status,
        "is_eligible":    s.is_eligible,
        "attempt_count":  s.attempt_count,
        "duplicate_flag": s.duplicate_flag,
        "face_registered":s.face_encoding is not None,
        "registered_at":  str(s.registered_at),
    }