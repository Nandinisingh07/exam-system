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
    
    # Attendance Data
    attendance_data = [
        {"day": "Mon", "present": 1120, "absent": 164},
        {"day": "Tue", "present": 1198, "absent": 86},
        {"day": "Wed", "present": 1082, "absent": 202},
        {"day": "Thu", "present": 1240, "absent": 44},
        {"day": "Fri", "present": 1167, "absent": 117},
        {"day": "Sat", "present": 954, "absent": 330},
    ]
    
    # Room Data
    classrooms = db.query(Classroom).all()
    rooms = []
    for room in classrooms:
        # Mock logic
        rooms.append({
            "room": room.room_number,
            "capacity": room.capacity,
            "seated": room.capacity - 2, # Fake data
            "invigilator": "Prof. A. Kumar",
            "status": "Active" if len(rooms) % 2 == 0 else "Alert",
            "exam": "CS-402"
        })
    
    if not rooms:
        rooms = [
            {"room": "101", "capacity": 40, "seated": 38, "invigilator": "Prof. A. Kumar", "status": "Active", "exam": "CS-402"},
            {"room": "102", "capacity": 40, "seated": 40, "invigilator": "Dr. S. Mehta", "status": "Active", "exam": "CS-402"},
        ]

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
    
    pie = [
        {"name": "Verified", "value": 1082, "color": "#7c3aed"},
        {"name": "Pending", "value": 142, "color": "#f59e0b"},
        {"name": "Absent", "value": 60, "color": "#f43f5e"},
    ]
    
    verify_data = [
        {"time": "8AM", "v": 0}, {"time": "9AM", "v": 312}, {"time": "10AM", "v": 487},
        {"time": "11AM", "v": 620}, {"time": "12PM", "v": 589}, {"time": "1PM", "v": 204}, {"time": "2PM", "v": 145},
    ]

    return {
        "stats": stats,
        "attendance": attendance_data,
        "verify_data": verify_data,
        "rooms": rooms,
        "feed": feed,
        "pie": pie
    }
