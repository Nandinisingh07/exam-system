from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.timetable import Timetable, Duty
from ..models.user import User
from ..utils.auth import require_admin, get_current_user
from ..config import settings
import os, uuid
from datetime import date, time

router = APIRouter(prefix="/api/timetable", tags=["timetable"])

@router.post("/upload")
async def upload_timetable(
    subject: str = Form(...),
    exam_date: str = Form(...),   # "YYYY-MM-DD"
    start_time: str = Form(...),  # "HH:MM"
    end_time: str = Form(...),
    room_no: str = Form(None),
    class_name: str = Form(...),
    year: int = Form(...),
    semester: int = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    filepath = None
    if file:
        os.makedirs(settings.UPLOAD_DIR + "/timetables", exist_ok=True)
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(settings.UPLOAD_DIR, "timetables", filename)
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)

    tt = Timetable(
        subject=subject,
        exam_date=date.fromisoformat(exam_date),
        start_time=time.fromisoformat(start_time),
        end_time=time.fromisoformat(end_time),
        room_no=room_no,
        class_name=class_name,
        year=year,
        semester=semester,
        file_path=filepath,
        created_by=admin.id
    )
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return {"message": "Timetable entry created", "id": tt.id}

@router.post("/{timetable_id}/assign-duty")
def assign_duty(
    timetable_id: int,
    invigilator_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    tt = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not tt:
        raise HTTPException(404, "Timetable entry not found")
    invig = db.query(User).filter(User.id == invigilator_id).first()
    if not invig:
        raise HTTPException(404, "Invigilator not found")
    duty = Duty(timetable_id=timetable_id, invigilator_id=invigilator_id)
    db.add(duty)
    db.commit()
    return {"message": "Duty assigned"}

@router.get("/my-duties")
def get_my_duties(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    duties = db.query(Duty).filter(Duty.invigilator_id == user.id).all()
    result = []
    for d in duties:
        tt = d.timetable
        result.append({
            "duty_id": d.id,
            "timetable_id": tt.id,
            "subject": tt.subject,
            "exam_date": str(tt.exam_date),
            "start_time": str(tt.start_time),
            "end_time": str(tt.end_time),
            "room_no": tt.room_no,
            "class_name": tt.class_name,
            "year": tt.year,
            "semester": tt.semester,
        })
    return result

@router.get("/all")
def get_all_timetables(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    timetables = db.query(Timetable).all()
    return [{"id": t.id, "subject": t.subject, "exam_date": str(t.exam_date),
             "start_time": str(t.start_time), "room_no": t.room_no,
             "class_name": t.class_name, "year": t.year, "semester": t.semester} for t in timetables]