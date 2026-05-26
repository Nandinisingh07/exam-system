from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Float, Boolean
from sqlalchemy.sql import func
from ..database import Base
from sqlalchemy.orm import relationship

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)

    # --- IDENTITY FIELDS ---
    name            = Column(String, nullable=False)
    father_name     = Column(String, nullable=True)
    enrollment_no   = Column(String, unique=True, index=True, nullable=False)
    student_id_no   = Column(String, unique=True, index=True, nullable=True)   # College Student ID (e.g. 4851087)
    email           = Column(String, unique=True, index=True, nullable=True)
    phone           = Column(String, nullable=True)

    # --- ACADEMIC FIELDS ---
    class_name      = Column(String, nullable=False)   # Branch / Section e.g. BE-CS-A
    year            = Column(Integer, nullable=False)
    semester        = Column(Integer, nullable=False)
    college_name    = Column(String, nullable=True)

    # --- EXAM CENTRE FIELDS ---
    centre_code     = Column(String, nullable=True)
    centre_name     = Column(String, nullable=True)
    practical_centre= Column(String, nullable=True)
    exam_session    = Column(String, nullable=True)    # e.g. 2024-25
    exam_shift      = Column(String, nullable=True)    # e.g. Morning / Evening

    # --- FACE DATA ---
    face_image_path = Column(String, nullable=True)
    face_encoding   = Column(LargeBinary, nullable=True)   # pickled numpy array
    face_confidence_threshold = Column(Float, default=0.75)

    # --- SECURITY & ELIGIBILITY ---
    fee_status      = Column(String, default="paid")   # paid / pending
    is_eligible     = Column(Boolean, default=True)
    duplicate_flag  = Column(Boolean, default=False)
    attempt_count   = Column(Integer, default=0)

    # --- SYSTEM FIELDS ---
    registered_at   = Column(DateTime(timezone=True), server_default=func.now())

    # --- RELATIONSHIPS ---
    seat_allocations   = relationship("SeatAllocation", back_populates="student")
    attendance_records = relationship("AttendanceRecord", back_populates="student")