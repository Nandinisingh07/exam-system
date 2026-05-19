from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Student, SeatAllocation, Exam
from ..utils.auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/student", tags=["student-portal"])

@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Match user email with student email
    student = db.query(Student).filter(Student.email == user.email).first()
    if not student:
        raise HTTPException(404, "Student profile not found for this user")
    
    return {
        "id": student.id,
        "name": student.name,
        "enrollment_no": student.enrollment_no,
        "class_name": student.class_name,
        "year": student.year,
        "semester": student.semester,
        "email": student.email,
        "phone": student.phone
    }

@router.get("/schedule")
def get_schedule(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.email == user.email).first()
    if not student:
        raise HTTPException(404, "Student not found")
        
    # Get exams student is allocated to
    allocations = db.query(SeatAllocation).filter(SeatAllocation.student_id == student.id).all()
    
    result = []
    for a in allocations:
        e = a.exam
        result.append({
            "id": e.id,
            "subject_code": e.subject_code,
            "subject_name": e.subject_name,
            "date": e.date.strftime("%B %d, %Y"),
            "time": "09:00 AM – 12:00 PM",
            "room": a.classroom.room_number if a.classroom else "N/A",
            "seat": a.seat_number,
            "status": "Scheduled"
        })
    return result

@router.get("/seat/{exam_id}")
def get_seat(exam_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.email == user.email).first()
    if not student:
        raise HTTPException(404, "Student not found")
        
    allocation = db.query(SeatAllocation).filter(
        SeatAllocation.student_id == student.id,
        SeatAllocation.exam_id == exam_id
    ).first()
    
    if not allocation:
        raise HTTPException(404, "Seat not allocated yet")
        
    return {
        "room": allocation.classroom.room_number,
        "seat": allocation.seat_number,
        "floor": allocation.classroom.floor
    }
