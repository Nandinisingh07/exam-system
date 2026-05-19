from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Timetable(Base):
    __tablename__ = "timetables"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    exam_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room_no = Column(String)
    class_name = Column(String)
    year = Column(Integer)
    semester = Column(Integer)
    file_path = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    duties = relationship("Duty", back_populates="timetable")

class Duty(Base):
    __tablename__ = "duties"
    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"))
    invigilator_id = Column(Integer, ForeignKey("users.id"))
    timetable = relationship("Timetable", back_populates="duties")
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())