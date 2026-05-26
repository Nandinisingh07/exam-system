"""
seed.py — Safe, idempotent database seeder.

IMPORTANT: This script uses create_all (NOT drop_all).
It will NEVER delete existing data. Re-running it is safe.
Each record is only inserted if it doesn't already exist.
"""
from app.database import SessionLocal, engine, Base
from app.models import (
    User, UserRole,
    Student,
    Classroom, Exam, SeatAllocation, DutyAssignment,
    WashroomLog, BiometricLog, VerificationLog,
    AttendanceRecord, ManualReviewQueue, FraudAlert,
)
from app.utils.auth import hash_password
from datetime import datetime, timedelta


def get_or_create_user(db, email, name, password, role):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"  [skip] User already exists: {email}")
        return existing
    u = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(u)
    db.flush()
    print(f"  [created] User: {email} ({role.value})")
    return u


def get_or_create_classroom(db, room_number, capacity, floor, room_type, status):
    existing = db.query(Classroom).filter(Classroom.room_number == room_number).first()
    if existing:
        print(f"  [skip] Classroom already exists: {room_number}")
        return existing
    r = Classroom(room_number=room_number, capacity=capacity, floor=floor, room_type=room_type, status=status)
    db.add(r)
    db.flush()
    print(f"  [created] Classroom: {room_number}")
    return r


def get_or_create_exam(db, subject_code, subject_name, date):
    existing = db.query(Exam).filter(Exam.subject_code == subject_code).first()
    if existing:
        print(f"  [skip] Exam already exists: {subject_code}")
        return existing
    e = Exam(subject_code=subject_code, subject_name=subject_name, date=date)
    db.add(e)
    db.flush()
    print(f"  [created] Exam: {subject_code}")
    return e


def seed():
    print("=" * 50)
    print("SEAS Database Seeder (safe, idempotent)")
    print("=" * 50)

    # Create all tables if they don't exist — NEVER drops existing data
    Base.metadata.create_all(bind=engine)
    print("[DB] Tables verified/created.")

    db = SessionLocal()
    try:
        # ── Users ──────────────────────────────────────────
        print("\nSeeding users...")
        admin = get_or_create_user(db, "admin@exam.com",   "System Administrator", "admin123",   UserRole.admin)
        t1    = get_or_create_user(db, "teacher@exam.com", "Prof. Sarah Mathews",  "teacher123", UserRole.invigilator)
        _     = get_or_create_user(db, "student@exam.com", "Arjun Sharma",         "student123", UserRole.student)
        t2    = get_or_create_user(db, "rajesh@exam.com",  "Dr. Rajesh Kumar",     "teacher123", UserRole.invigilator)
        _     = get_or_create_user(db, "ananya@exam.com",  "Ms. Ananya Singh",     "teacher123", UserRole.invigilator)
        _     = get_or_create_user(db, "amit@exam.com",    "Prof. Amit Verma",     "teacher123", UserRole.invigilator)
        db.commit()

        # ── Classrooms ─────────────────────────────────────
        print("\nSeeding classrooms...")
        r1 = get_or_create_classroom(db, "101", 40, 1, "Large Hall",   "Active")
        r2 = get_or_create_classroom(db, "102", 40, 1, "Standard",     "Active")
        _  = get_or_create_classroom(db, "201", 35, 2, "Computer Lab", "Active")
        _  = get_or_create_classroom(db, "202", 35, 2, "Standard",     "Active")
        _  = get_or_create_classroom(db, "301", 30, 3, "Standard",     "Active")
        _  = get_or_create_classroom(db, "302", 30, 3, "Standard",     "Active")
        db.commit()

        # ── Exams ──────────────────────────────────────────
        print("\nSeeding exams...")
        now = datetime.now()
        e1 = get_or_create_exam(db, "CS-402", "Computer Networks",      now + timedelta(hours=2))
        _  = get_or_create_exam(db, "CS-401", "Operating Systems",      now + timedelta(days=1))
        _  = get_or_create_exam(db, "CS-302", "Database Systems",       now + timedelta(days=2))
        _  = get_or_create_exam(db, "MA-201", "Engineering Mathematics", now + timedelta(days=3))
        db.commit()

        # ── Duties ─────────────────────────────────────────
        print("\nSeeding duties...")
        exists = db.query(DutyAssignment).filter(
            DutyAssignment.teacher_id == t1.id,
            DutyAssignment.exam_id == e1.id,
            DutyAssignment.classroom_id == r1.id,
        ).first()
        if not exists:
            db.add(DutyAssignment(teacher_id=t1.id, exam_id=e1.id, classroom_id=r1.id))
            print(f"  [created] Duty: {t1.email} → exam {e1.subject_code}, room {r1.room_number}")
        else:
            print(f"  [skip] Duty already exists")

        exists2 = db.query(DutyAssignment).filter(
            DutyAssignment.teacher_id == t2.id,
            DutyAssignment.exam_id == e1.id,
            DutyAssignment.classroom_id == r2.id,
        ).first()
        if not exists2:
            db.add(DutyAssignment(teacher_id=t2.id, exam_id=e1.id, classroom_id=r2.id))
            print(f"  [created] Duty: {t2.email} → exam {e1.subject_code}, room {r2.room_number}")
        else:
            print(f"  [skip] Duty already exists")

        db.commit()

        print("\n" + "=" * 50)
        print("Seeding complete. No existing data was modified.")
        print("=" * 50)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()