import sys
import os
import random
import uuid
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont

# Change to backend directory to load .env
os.chdir(os.path.join(os.getcwd(), 'backend'))
sys.path.append(os.getcwd())

from app.database import SessionLocal, engine, Base
from app.models import User, UserRole, Student, Classroom, Exam, SeatAllocation, DutyAssignment
from app.utils.auth import hash_password

# Constants (Relative to root, so go up one level)
FIXTURE_ADMIT_CARDS = os.path.join('..', 'tests', 'fixtures', 'admit_cards')
FIXTURE_FACES = os.path.join('..', 'tests', 'fixtures', 'faces')
BRANCHES = ['CS', 'IT', 'EC', 'ME', 'CE']
YEAR = 2024
COUNT = 1000

def generate_admit_card(student_name, enrollment_no, exam_name, seat_number, output_path):
    # Create a white image
    img = Image.new('RGB', (600, 400), color='white')
    d = ImageDraw.Draw(img)
    
    # Try to load a font, fallback to default
    try:
        font_large = ImageFont.truetype("arial.ttf", 30)
        font_small = ImageFont.truetype("arial.ttf", 20)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    d.text((200, 20), "SEAS COLLEGE", fill='black', font=font_large)
    d.text((50, 100), f"Name: {student_name}", fill='black', font=font_small)
    d.text((50, 140), f"Enrollment: {enrollment_no}", fill='black', font=font_small)
    d.text((50, 180), f"Exam: {exam_name}", fill='black', font=font_small)
    d.text((50, 220), f"Seat: {seat_number}", fill='black', font=font_small)
    
    img.save(output_path)

def generate_face_placeholder(name, output_path):
    initials = "".join([n[0] for n in name.split()[:2]]).upper()
    color = (random.randint(50, 200), random.randint(50, 200), random.randint(50, 200))
    
    img = Image.new('RGB', (200, 200), color='white')
    d = ImageDraw.Draw(img)
    
    d.ellipse([10, 10, 190, 190], fill=color, outline='black')
    
    try:
        font = ImageFont.truetype("arial.ttf", 80)
    except:
        font = ImageFont.load_default()
        
    # Center text roughly
    d.text((60, 60), initials, fill='white', font=font)
    
    img.save(output_path)

def seed_data():
    db = SessionLocal()
    print(f"Starting synthetic data generation for {COUNT} students...")
    
    # 1. Create Admin (Idempotent)
    admin = db.query(User).filter(User.email == "admin@seas.com").first()
    if not admin:
        admin = User(
            name="System Admin",
            email="admin@seas.com",
            hashed_password=hash_password("admin"),
            role=UserRole.admin
        )
        db.add(admin)
        db.commit()

    # 2. Create Invigilators (Idempotent)
    invigilators = []
    for i in range(1, 3):
        email = f"inv{i}@exam.com"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                name=f"Invigilator {i}",
                email=email,
                hashed_password=hash_password("Test@1234"),
                role=UserRole.invigilator
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        invigilators.append(user)

    # 2. Create Exams (Idempotent)
    exam_data = [
        ("CS-501", "Database Systems"),
        ("IT-502", "Web Technologies"),
        ("EC-503", "Digital Signal Processing")
    ]
    exams = []
    for code, name in exam_data:
        exam = db.query(Exam).filter(Exam.subject_code == code).first()
        if not exam:
            exam = Exam(
                subject_code=code,
                subject_name=name,
                date=datetime.now() + timedelta(days=random.randint(1, 10))
            )
            db.add(exam)
            db.commit()
            db.refresh(exam)
        exams.append(exam)

    # 3. Create Classrooms if none exist
    rooms = db.query(Classroom).all()
    if not rooms:
        rooms = [
            Classroom(room_number="H-101", capacity=400, floor=1, room_type="Hall"),
            Classroom(room_number="H-201", capacity=400, floor=2, room_type="Hall"),
            Classroom(room_number="L-301", capacity=200, floor=3, room_type="Lab")
        ]
        for r in rooms: db.add(r)
        db.commit()
        rooms = db.query(Classroom).all()

    # 4. Generate Students and Seat Allocations
    students_created = 0
    allocations_created = 0
    
    first_names = ["Arjun", "Priya", "Rahul", "Anjali", "Siddharth", "Neha", "Vikram", "Kavita", "Amit", "Pooja"]
    last_names = ["Sharma", "Patel", "Verma", "Iyer", "Gupta", "Singh", "Reddy", "Nair", "Das", "Joshi"]

    for i in range(COUNT):
        branch = random.choice(BRANCHES)
        roll_no = f"{i+1:04d}"
        enrollment_no = f"{YEAR}-{branch}-{roll_no}"
        
        # Check if exists
        student = db.query(Student).filter(Student.enrollment_no == enrollment_no).first()
        if not student:
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            student = Student(
                name=name,
                enrollment_no=enrollment_no,
                email=f"student_{roll_no}@exam.com",
                class_name=f"BE-{branch}-A",
                year=3,
                semester=5
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            students_created += 1
            
            # Generate Fixtures
            face_path = os.path.join(FIXTURE_FACES, f"{enrollment_no}.png")
            generate_face_placeholder(name, face_path)
            
            # Randomly allocate to one of the 3 exams
            exam = random.choice(exams)
            room = random.choice(rooms)
            seat = f"S-{i+1}"
            
            # Check if allocation exists
            alloc = db.query(SeatAllocation).filter(
                SeatAllocation.student_id == student.id,
                SeatAllocation.exam_id == exam.id
            ).first()
            
            if not alloc:
                allocation = SeatAllocation(
                    student_id=student.id,
                    exam_id=exam.id,
                    classroom_id=room.id,
                    seat_number=seat
                )
                db.add(allocation)
                allocations_created += 1
                
                # Generate Admit Card
                admit_path = os.path.join(FIXTURE_ADMIT_CARDS, f"{enrollment_no}.png")
                generate_admit_card(name, enrollment_no, exam.subject_name, seat, admit_path)

    db.commit()
    print("\n--- Generation Summary ---")
    print(f"New Students Created: {students_created}")
    print(f"New Seat Allocations: {allocations_created}")
    print(f"Total Students in DB: {db.query(Student).count()}")
    print(f"Admit Cards in {FIXTURE_ADMIT_CARDS}: {len(os.listdir(FIXTURE_ADMIT_CARDS))}")
    print(f"Faces in {FIXTURE_FACES}: {len(os.listdir(FIXTURE_FACES))}")
    print(f"Invigilators: inv1, inv2 (Password: Test@1234)")
    print("--------------------------")
    db.close()

if __name__ == "__main__":
    seed_data()
