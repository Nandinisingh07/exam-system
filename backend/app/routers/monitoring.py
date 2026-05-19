from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import WashroomLog, BiometricLog, VerificationLog, Student, SeatAllocation
from ..utils.auth import get_current_user
from ..models.user import User
from datetime import datetime

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

@router.post("/washroom/exit")
def log_exit(enrollment_no: str, exam_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.enrollment_no == enrollment_no).first()
    if not student:
        raise HTTPException(404, "Student not found")
        
    # Check if student is already out
    existing = db.query(WashroomLog).filter(
        WashroomLog.student_id == student.id,
        WashroomLog.exam_id == exam_id,
        WashroomLog.entry_time == None
    ).first()
    if existing:
        raise HTTPException(400, "Student is already logged as outside")
        
    log = WashroomLog(student_id=student.id, exam_id=exam_id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

@router.post("/washroom/entry/{log_id}")
def log_entry(log_id: int, db: Session = Depends(get_db)):
    log = db.query(WashroomLog).filter(WashroomLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Log not found")
    
    log.entry_time = datetime.now()
    db.commit()
    db.refresh(log)
    return {
        "id": log.id,
        "student_id": log.student_id,
        "exam_id": log.exam_id,
        "exit_time": str(log.exit_time),
        "entry_time": str(log.entry_time)
    }

@router.get("/washroom")
def get_washroom_logs(exam_id: int, db: Session = Depends(get_db)):
    logs = db.query(WashroomLog).filter(WashroomLog.exam_id == exam_id).order_by(WashroomLog.exit_time.desc()).all()
    result = []
    for l in logs:
        # Get seat
        seat = db.query(SeatAllocation).filter(
            SeatAllocation.student_id == l.student_id,
            SeatAllocation.exam_id == l.exam_id
        ).first()
        
        result.append({
            "id": l.id,
            "student_name": l.student.name,
            "enrollment": l.student.enrollment_no,
            "exit_time": str(l.exit_time),
            "entry_time": str(l.entry_time) if l.entry_time else None,
            "room": seat.classroom.room_number if seat else "—",
            "seat": seat.seat_number if seat else "—"
        })
    return result

@router.get("/biometric")
def get_biometric_logs(db: Session = Depends(get_db)):
    return db.query(BiometricLog).all()
