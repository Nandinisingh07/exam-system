from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models.student import Student
from ..models.logistics import Classroom, Exam, SeatAllocation, DutyAssignment
from ..models.monitoring import VerificationLog, WashroomLog
from ..models.attendance import AttendanceRecord
from ..utils.auth import get_current_user, require_admin
from ..models.user import User
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_students = db.query(func.count(Student.id)).scalar() or 0
    active_exams = db.query(func.count(Exam.id)).filter(Exam.date >= today_start).scalar() or 0
    
    # Fake verified today just to return something if DB is empty
    verified_today = db.query(func.count(VerificationLog.id)).filter(VerificationLog.timestamp >= today_start).scalar() or 0
    
    alerts = db.query(func.count(WashroomLog.id)).filter(WashroomLog.entry_time == None).scalar() or 0
    
    stats = {
        "students": total_students,
        "exams": active_exams,
        "verified": verified_today,
        "alerts": alerts
    }
    
    # Real Attendance Data - last 6 days
    attendance_data = []
    for i in range(5, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        present = db.query(func.count(AttendanceRecord.id)).filter(
            AttendanceRecord.timestamp >= day_start,
            AttendanceRecord.timestamp < day_end,
            AttendanceRecord.status == "Present"
        ).scalar() or 0
        absent = db.query(func.count(AttendanceRecord.id)).filter(
            AttendanceRecord.timestamp >= day_start,
            AttendanceRecord.timestamp < day_end,
            AttendanceRecord.status == "Absent"
        ).scalar() or 0
        attendance_data.append({
            "day": day_start.strftime("%a"),
            "present": present,
            "absent": absent
        })
    
    # Real Room Data
    classrooms = db.query(Classroom).all()
    rooms = []
    for room in classrooms:
        duty = db.query(DutyAssignment).filter(DutyAssignment.classroom_id == room.id).first()
        seated = db.query(func.count(SeatAllocation.id)).filter(SeatAllocation.classroom_id == room.id).scalar() or 0
        washroom_alerts = db.query(func.count(WashroomLog.id)).filter(
            WashroomLog.classroom_id == room.id,
            WashroomLog.entry_time == None
        ).scalar() or 0
        invigilator_name = duty.teacher.full_name if duty and duty.teacher else "Unassigned"
        exam_code = duty.exam.subject_code if duty and duty.exam else "-"
        rooms.append({
            "room": room.room_number,
            "capacity": room.capacity,
            "seated": seated,
            "invigilator": invigilator_name,
            "status": "Alert" if washroom_alerts > 0 else "Active",
            "exam": exam_code
        })

    # Real Activity Feed
    logs = db.query(VerificationLog).order_by(VerificationLog.timestamp.desc()).limit(5).all()
    feed = []
    for log in logs:
        feed.append({
            "msg": f"Student {log.student_name} — {'Verified' if log.status == 'Success' else 'Verification Failed'}",
            "room": log.room_no or "N/A",
            "time": "Just now", # Simple for now
            "s": "success" if log.status == "Success" else "warning"
        })
    
    # Add washroom alerts to feed
    w_logs = db.query(WashroomLog).filter(WashroomLog.entry_time == None).order_by(WashroomLog.exit_time.desc()).limit(2).all()
    for w in w_logs:
        feed.append({
            "msg": f"Washroom alert: {w.student.name if w.student else 'Unknown'}",
            "room": w.classroom.room_number if w.classroom else "N/A",
            "time": "Active",
            "s": "warning"
        })

    if not feed:
        feed = [{"msg": "System operational. No recent activity.", "room": "-", "time": "Now", "s": "info"}]
    
    total_alloc = db.query(func.count(SeatAllocation.id)).scalar() or 0
    verified_count = db.query(func.count(VerificationLog.id)).filter(
        VerificationLog.status == "Success",
        VerificationLog.timestamp >= today_start
    ).scalar() or 0
    pending_count = max(0, total_alloc - verified_count)
    absent_count = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.status == "Absent",
        AttendanceRecord.timestamp >= today_start
    ).scalar() or 0

    pie = [
        {"name": "Verified", "value": verified_count, "color": "#7c3aed"},
        {"name": "Pending", "value": pending_count, "color": "#f59e0b"},
        {"name": "Absent", "value": absent_count, "color": "#f43f5e"},
    ]

    verify_data = []
    for hour in range(8, 15):
        h_start = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        h_end = h_start + timedelta(hours=1)
        count = db.query(func.count(VerificationLog.id)).filter(
            VerificationLog.timestamp >= h_start,
            VerificationLog.timestamp < h_end,
            VerificationLog.status == "Success"
        ).scalar() or 0
        verify_data.append({"time": f"{hour}AM" if hour < 12 else f"{hour-12}PM", "v": count})

    return {
        "stats": stats,
        "attendance": attendance_data,
        "verify_data": verify_data,
        "rooms": rooms,
        "feed": feed,
        "pie": pie
    }
