from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class WashroomLog(Base):
    __tablename__ = "washroom_logs"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    exit_time = Column(DateTime(timezone=True), server_default=func.now())
    entry_time = Column(DateTime(timezone=True), nullable=True)
    is_anomaly = Column(Boolean, default=False) # e.g., staying too long
    
    student = relationship("Student")
    exam = relationship("Exam")

class BiometricLog(Base):
    __tablename__ = "biometric_logs"
    id = Column(Integer, primary_key=True, index=True)
    biometric_user_id = Column(String, index=True) # ID from eSSL K30 Pro
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    device_id = Column(String)
    raw_data = Column(String) # JSON or raw string from device
    
class VerificationLog(Base):
    __tablename__ = "verification_logs"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    verified_by = Column(Integer, ForeignKey("users.id"))
    method = Column(String) # Face, QR, Manual
    status = Column(String) # Success, Flagged, Failed
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    student = relationship("Student")
    exam = relationship("Exam")
    invigilator = relationship("User")
