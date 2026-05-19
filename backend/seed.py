import random
from app.database import SessionLocal, engine, Base
from app.models import User, UserRole, Student, Classroom, Exam, SeatAllocation, DutyAssignment
from app.utils.auth import hash_password
from datetime import datetime, timedelta

def seed():
    print("Cleaning database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Create Users
    print("Seeding users...")
    users = [
        User(name="System Administrator", email="admin@exam.com", hashed_password=hash_password("admin123"), role=UserRole.admin),
        User(name="Prof. Sarah Mathews", email="teacher@exam.com", hashed_password=hash_password("teacher123"), role=UserRole.invigilator),
        User(name="Arjun Sharma", email="student@exam.com", hashed_password=hash_password("student123"), role=UserRole.student)
    ]
    # Add more teachers
    teachers = [
        User(name="Dr. Rajesh Kumar", email="rajesh@exam.com", hashed_password=hash_password("teacher123"), role=UserRole.invigilator),
        User(name="Ms. Ananya Singh", email="ananya@exam.com", hashed_password=hash_password("teacher123"), role=UserRole.invigilator),
        User(name="Prof. Amit Verma", email="amit@exam.com", hashed_password=hash_password("teacher123"), role=UserRole.invigilator)
    ]
    all_users = users + teachers
    for u in all_users: db.add(u)
    db.commit()
    
    # 2. Create Classrooms
    print("Seeding classrooms...")
    rooms = [
        Classroom(room_number="101", capacity=40, floor=1, room_type="Large Hall", status="Active"),
        Classroom(room_number="102", capacity=40, floor=1, room_type="Standard", status="Active"),
        Classroom(room_number="201", capacity=35, floor=2, room_type="Computer Lab", status="Active"),
        Classroom(room_number="202", capacity=35, floor=2, room_type="Standard", status="Active"),
        Classroom(room_number="301", capacity=30, floor=3, room_type="Standard", status="Active"),
        Classroom(room_number="302", capacity=30, floor=3, room_type="Standard", status="Active"),
    ]
    for r in rooms: db.add(r)
    db.commit()

    # 3. Create Exams
    print("Seeding exams...")
    exams = [
        Exam(subject_code="CS-402", subject_name="Computer Networks", date=datetime.now() + timedelta(hours=2)),
        Exam(subject_code="CS-401", subject_name="Operating Systems", date=datetime.now() + timedelta(days=1)),
        Exam(subject_code="CS-302", subject_name="Database Systems", date=datetime.now() + timedelta(days=2)),
        Exam(subject_code="MA-201", subject_name="Engineering Mathematics", date=datetime.now() + timedelta(days=3)),
    ]
    for e in exams: db.add(e)
    db.commit()

    # 4. Create Students
    print("Seeding 100 students...")
    first_names = ["Arjun", "Priya", "Rahul", "Anjali", "Siddharth", "Ishani", "Vikram", "Sneha", "Karan", "Divya", "Aditya", "Riya", "Sahil", "Tanya", "Vivek"]
    last_names = ["Sharma", "Patel", "Verma", "Singh", "Iyer", "Nair", "Kapoor", "Reddy", "Gupta", "Malhotra", "Joshi", "Mehta", "Bose", "Chawla", "Desai"]
    
    all_students = []
    # Seed the primary 3 students first to avoid collisions
    primary_students = [
        ("Arjun Sharma", "CS20230042", "student@exam.com"),
        ("Priya Patel", "CS20230058", "priya@exam.com"),
        ("Rahul Verma", "ME20230112", "rahul@exam.com")
    ]
    
    used_enrollments = set()
    for name, enroll, email in primary_students:
        s = Student(
            name=name, enrollment_no=enroll, email=email,
            phone=f"+91 98765{random.randint(10000,99999)}",
            class_name="BE-CS-A", year=3, semester=6,
            face_encoding=b"fake_encoding_blob" # Primary students always verified
        )
        db.add(s)
        all_students.append(s)
        used_enrollments.add(enroll)

    for i in range(100):
        enroll = f"CS2024{i:04d}" # Use 2024 to avoid collision with 2023
        if enroll in used_enrollments: continue
        
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        name = f"{fname} {lname}"
        email = f"{fname.lower()}.{lname.lower()}{i}@example.com"
            
        student = Student(
            name=name,
            enrollment_no=enroll,
            email=email,
            phone=f"+91 91234{i:05d}",
            class_name=random.choice(["BE-CS-A", "BE-CS-B", "BE-IT-A", "BE-EC-A"]),
            year=random.randint(1, 4),
            semester=random.randint(1, 8),
            face_encoding=b"fake_encoding_blob" if random.random() > 0.4 else None
        )
        db.add(student)
        all_students.append(student)
        used_enrollments.add(enroll)
    
    db.commit()

    # 5. Duties & Allocations
    print("Seeding duties and seat allocations...")
    db.add(DutyAssignment(teacher_id=all_users[1].id, exam_id=exams[0].id, classroom_id=rooms[0].id))
    db.add(DutyAssignment(teacher_id=all_users[3].id, exam_id=exams[0].id, classroom_id=rooms[1].id))

    for i, s in enumerate(all_students):
        # Fill rooms for the first exam
        room_idx = (i // 40)
        if room_idx < len(rooms):
            allocation = SeatAllocation(
                student_id=s.id,
                exam_id=exams[0].id,
                classroom_id=rooms[room_idx].id,
                seat_number=f"{chr(65 + (i % 5))}-{(i % 20) + 1:02d}"
            )
            db.add(allocation)
            
    db.commit()
    print(f"Successfully seeded {len(all_students)} students and full schedules!")
    db.close()

if __name__ == "__main__":
    seed()
