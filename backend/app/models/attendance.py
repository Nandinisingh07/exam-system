from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"))
    exam_id     = Column(Integer, ForeignKey("exams.id"))
    marked_by   = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Individual verification flags
    face_verified   = Column(Boolean, default=False)
    admit_verified  = Column(Boolean, default=False)
    id_verified     = Column(Boolean, default=False)

    # Confidence scores (0.0 – 100.0)
    face_score      = Column(Float, nullable=True)
    ocr_score       = Column(Float, nullable=True)
    id_score        = Column(Float, nullable=True)
    liveness_score  = Column(Float, nullable=True)
    final_confidence= Column(Float, nullable=True)

    # Decision
    decision        = Column(String, nullable=True)   # AUTO_APPROVE / MANUAL_REVIEW / REJECT
    status          = Column(String, default="Present")  # Present / Absent / Malpractice

    # Extra context
    gate_id         = Column(String, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    marked_at       = Column(DateTime(timezone=True), server_default=func.now())

    student     = relationship("Student", back_populates="attendance_records")
    exam        = relationship("Exam", back_populates="attendance")
    invigilator = relationship("User")


class ManualReviewQueue(Base):
    __tablename__ = "manual_review_queue"
    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=True)
    exam_id         = Column(Integer, ForeignKey("exams.id"), nullable=True)
    enrollment_detected = Column(String, nullable=True)
    face_score      = Column(Float, nullable=True)
    ocr_score       = Column(Float, nullable=True)
    id_score        = Column(Float, nullable=True)
    final_confidence= Column(Float, nullable=True)
    reason          = Column(String, nullable=True)
    review_status   = Column(String, default="pending")  # pending / approved / rejected
    reviewed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at     = Column(DateTime(timezone=True), nullable=True)

    student = relationship("Student")


class FraudAlert(Base):
    __tablename__ = "fraud_alerts"
    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=True)
    exam_id     = Column(Integer, ForeignKey("exams.id"), nullable=True)
    alert_type  = Column(String)   # duplicate_entry / spoof_attempt / id_mismatch / ineligible
    details     = Column(String, nullable=True)
    severity    = Column(String, default="medium")  # low / medium / high / critical
    resolved    = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")