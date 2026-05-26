from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Classroom(Base):
    __tablename__ = "classrooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    floor = Column(Integer)
    room_type = Column(String, default="Standard")
    status = Column(String, default="Available") # Available, Active, Alert, Maintenance
    
    seat_allocations = relationship("SeatAllocation", back_populates="classroom")
    duties = relationship("DutyAssignment", back_populates="classroom")

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    subject_code = Column(String, index=True, nullable=False)
    subject_name = Column(String, nullable=False)
    date = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=180)
    
    seat_allocations = relationship("SeatAllocation", back_populates="exam")
    duties = relationship("DutyAssignment", back_populates="exam")
    attendance = relationship("AttendanceRecord", back_populates="exam")

class SeatAllocation(Base):
    __tablename__ = "seat_allocations"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    seat_number = Column(String, nullable=False)
    
    student = relationship("Student", back_populates="seat_allocations")
    exam = relationship("Exam", back_populates="seat_allocations")
    classroom = relationship("Classroom", back_populates="seat_allocations")

class DutyAssignment(Base):
    __tablename__ = "duty_assignments"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    role = Column(String, default="Main Invigilator") # Main, Assistant, Relief
    
    teacher = relationship("User")
    exam = relationship("Exam", back_populates="duties")
    classroom = relationship("Classroom", back_populates="duties")

class DutyDocument(Base):
    __tablename__ = "duty_documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    status = Column(String, default="Published")
