from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models.logistics import Classroom, Exam, SeatAllocation, DutyAssignment, DutyDocument
from ..utils.auth import get_current_user, require_admin
from ..models.user import User

class ClassroomCreate(BaseModel):
    room_number: str
    capacity: int
    floor: Optional[int] = 0
    room_type: Optional[str] = "Standard"
    status: Optional[str] = "Available"

class ExamCreate(BaseModel):
    subject_name: str
    subject_code: str
    date: str # ISO format
    time: str
    branch: Optional[str] = "All"

class DutyDocumentCreate(BaseModel):
    filename: str
    data_url: str

router = APIRouter(prefix="/api/logistics", tags=["logistics"])

@router.get("/classrooms")
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Classroom).all()

@router.post("/classrooms")
def add_room(room_in: ClassroomCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    room = Classroom(
        room_number=room_in.room_number, 
        capacity=room_in.capacity,
        floor=room_in.floor,
        room_type=room_in.room_type,
        status=room_in.status
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room

@router.get("/exams")
def get_exams(db: Session = Depends(get_db)):
    exams = db.query(Exam).all()
    result = []
    for e in exams:
        # Get count of unique classrooms allocated
        room_count = db.query(SeatAllocation.classroom_id).filter(SeatAllocation.exam_id == e.id).distinct().count()
        student_count = db.query(SeatAllocation).filter(SeatAllocation.exam_id == e.id).count()
        
        result.append({
            "id": e.id,
            "subject_name": e.subject_name,
            "subject_code": e.subject_code,
            "date": e.date.strftime("%b %d, %Y"),
            "time": "09:00 – 12:00", # demo
            "rooms": room_count,
            "students": student_count,
            "status": "Upcoming", # demo
            "branch": "All" # demo
        })
    return result

@router.post("/exams")
def add_exam(exam_in: ExamCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    from datetime import datetime
    exam = Exam(
        subject_name=exam_in.subject_name,
        subject_code=exam_in.subject_code,
        date=datetime.fromisoformat(exam_in.date)
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

@router.post("/allocations/generate/{exam_id}")
def generate_seats(exam_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    # Automated logic to map unallocated students to available classroom seats
    # This is a simplified version for demonstration
    from ..models.student import Student
    
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
        
    unallocated = db.query(Student).filter(~Student.seat_allocations.any(exam_id=exam_id)).all()
    rooms = db.query(Classroom).all()
    
    current_room_idx = 0
    current_seat_count = 1
    
    for student in unallocated:
        if current_room_idx >= len(rooms):
            break
            
        room = rooms[current_room_idx]
        if current_seat_count > room.capacity:
            current_room_idx += 1
            current_seat_count = 1
            if current_room_idx >= len(rooms): break
            room = rooms[current_room_idx]
            
        allocation = SeatAllocation(
            student_id=student.id,
            exam_id=exam_id,
            classroom_id=room.id,
            seat_number=f"{current_seat_count}"
        )
        db.add(allocation)
        current_seat_count += 1
        
    db.commit()
    return {"message": "Allocations generated successfullly"}

@router.get("/allocations/{exam_id}")
def get_allocations(exam_id: int, db: Session = Depends(get_db)):
    return db.query(SeatAllocation).filter(SeatAllocation.exam_id == exam_id).all()

@router.get("/duties")
def get_all_duties(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    duties = db.query(DutyAssignment).all()
    return [
        {
            "id": d.id,
            "teacher": d.teacher.name,
            "name": d.teacher.name,
            "email": d.teacher.email,
            "room": d.classroom.room_number,
            "exam": f"{d.exam.subject_code} {d.exam.subject_name}",
            "code": d.exam.subject_code,
            "date": d.exam.date.strftime("%Y-%m-%d"),
            "time": d.exam.date.strftime("%H:%M") if hasattr(d.exam.date, "strftime") else "09:00",
            "status": "Confirmed",
            "type": "manual"
        }
        for d in duties
    ]

@router.post("/duties")
def assign_duty(teacher_id: int, classroom_id: int, exam_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    duty = DutyAssignment(teacher_id=teacher_id, classroom_id=classroom_id, exam_id=exam_id)
    db.add(duty)
    db.commit()
    db.refresh(duty)
    return duty
@router.get("/my-duty")
def get_my_duty(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    duty = db.query(DutyAssignment).filter(DutyAssignment.teacher_id == user.id).first()
    
    if not duty:
        raise HTTPException(status_code=404, detail="No active duty assigned to you at this time.")
    
    # Get students assigned to this classroom for this exam
    allocations = db.query(SeatAllocation).filter(
        SeatAllocation.exam_id == duty.exam_id,
        SeatAllocation.classroom_id == duty.classroom_id
    ).all()
    
    students_list = []
    for a in allocations:
        # Check if verified
        from ..models.attendance import AttendanceRecord
        att = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == a.student_id,
            AttendanceRecord.exam_id == a.exam_id
        ).first()
        
        # Check if in washroom
        from ..models.monitoring import WashroomLog
        washroom = db.query(WashroomLog).filter(
            WashroomLog.student_id == a.student_id,
            WashroomLog.exam_id == a.exam_id,
            WashroomLog.entry_time == None
        ).first()
        
        status = "Pending"
        if att: status = "Verified"
        if washroom: status = "Washroom"
        
        students_list.append({
            "seat": a.seat_number,
            "name": a.student.name if a.student else "Unknown Student",
            "enrollment": a.student.enrollment_no if a.student else "N/A",
            "status": status,
            "time": str(att.marked_at.strftime("%H:%M %p")) if (att and att.marked_at) else "—"
        })
    
    return {
        "exam": duty.exam.subject_name,
        "code": duty.exam.subject_code,
        "date": duty.exam.date.strftime("%B %d, %Y"),
        "time": "09:00 AM – 12:00 PM", # Static for now
        "room": duty.classroom.room_number,
        "floor": f"Floor {duty.classroom.floor}",
        "totalStudents": len(allocations),
        "verified": len([s for s in students_list if s["status"] == "Verified"]),
        "absent": 0, # TBD
        "washroom": len([s for s in students_list if s["status"] == "Washroom"]),
        "students": students_list
    }

@router.get("/duty-documents")
def get_duty_documents(db: Session = Depends(get_db)):
    docs = db.query(DutyDocument).all()
    return [
        {
            "id": doc.id,
            "file": doc.filename,
            "filename": doc.filename,
            "dataUrl": doc.filepath,
            "uploadedAt": doc.uploaded_at.isoformat() if doc.uploaded_at else "",
            "status": doc.status or "Published"
        }
        for doc in docs
    ]

@router.post("/duty-documents")
def upload_duty_document(doc_in: DutyDocumentCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    doc = DutyDocument(
        filename=doc_in.filename,
        filepath=doc_in.data_url,
        status="Published"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "file": doc.filename,
        "filename": doc.filename,
        "dataUrl": doc.filepath,
        "uploadedAt": doc.uploaded_at.isoformat() if doc.uploaded_at else "",
        "status": doc.status
    }

@router.delete("/duty-documents/{doc_id}")
def delete_duty_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    doc = db.query(DutyDocument).filter(DutyDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Duty document not found")
    db.delete(doc)
    db.commit()
    return {"message": "Duty document deleted successfully"}

@router.delete("/duties/{duty_id}")
def delete_duty(duty_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    duty = db.query(DutyAssignment).filter(DutyAssignment.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Duty assignment not found")
    db.delete(duty)
    db.commit()
    return {"message": "Duty assignment deleted successfully"}
