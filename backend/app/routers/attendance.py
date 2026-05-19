from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AttendanceRecord, Student, Exam, User
from ..utils.auth import get_current_user
import pandas as pd
import io

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

@router.get("/exam/{exam_id}")
def get_attendance(exam_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(AttendanceRecord.exam_id == exam_id).all()
    result = []
    for r in records:
        student = r.student
        result.append({
            "id": r.id,
            "student_name": student.name if student else "Unknown",
            "enrollment_no": student.enrollment_no if student else "N/A",
            "face_verified": r.face_verified,
            "admit_verified": r.admit_verified,
            "status": r.status,
            "marked_at": str(r.marked_at)
        })
    return {"total": len(result), "records": result}

@router.get("/export/{exam_id}")
def export_attendance(exam_id: int, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.exam_id == exam_id).all()

    data = []
    for r in records:
        student = r.student
        data.append({
            "Name": student.name if student else "Unknown",
            "Enrollment No": student.enrollment_no if student else "N/A",
            "Face Verified": "Yes" if r.face_verified else "No",
            "Admit Verified": "Yes" if r.admit_verified else "No",
            "Status": r.status,
            "Time": str(r.marked_at)
        })

    df = pd.DataFrame(data)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    filename = f"attendance_{exam.subject_code if exam else exam_id}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )