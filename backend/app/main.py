from fastapi import FastAPI, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .config import settings
from .utils import metrics
import os, time

# CRITICAL: Import ALL models before create_all so SQLAlchemy knows about every table
from .models import (  # noqa: F401 — side-effect imports register models with Base
    User, UserRole,
    Student,
    Classroom, Exam, SeatAllocation, DutyAssignment, DutyDocument,
    WashroomLog, BiometricLog, VerificationLog,
    AttendanceRecord, ManualReviewQueue, FraudAlert,
)

# Create / migrate all tables on startup (safe — only adds missing tables/columns)
Base.metadata.create_all(bind=engine)
print("[DB] All tables verified/created.")

from .routers import auth, students, verification, attendance, logistics, monitoring, admin, student_portal

APP_START_TIME = time.time()

app = FastAPI(
    title="SEAS – Smart Examination Automated System",
    version="2.0.0",
    description="AI-powered Exam Verification with Face Recognition, OCR, and Confidence Engine",
)

origins = ["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174","http://127.0.0.1:5174","http://localhost:5175","http://127.0.0.1:5175","https://exam-system-eta-nine.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(logistics.router)
app.include_router(monitoring.router)
app.include_router(verification.router)
app.include_router(attendance.router)
app.include_router(admin.router)
app.include_router(student_portal.router)

@app.on_event("startup")
async def _load_face_cache():
    import asyncio
    from app.database import SessionLocal
    from app.services.face_service import load_embedding_cache
    await asyncio.sleep(0.5)
    db = SessionLocal()
    try:
        result = load_embedding_cache(db)
        print(f"[Startup] Face cache loaded: {len(result)} students ready")
    except Exception as e:
        print(f"[Startup] Cache load failed: {e}")
    finally:
        db.close()

    # Warm up InsightFace so first student isn't slow
    try:
        import numpy as np, cv2
        from app.services.face_service import _get_arcface
        dummy = np.zeros((320, 320, 3), dtype=np.uint8)
        app_if = _get_arcface()
        app_if.get(cv2.cvtColor(dummy, cv2.COLOR_BGR2RGB))
        print("[Startup] InsightFace warmed up — first verification will be fast")
    except Exception as e:
        print(f"[Startup] Warmup non-fatal: {e}")
@app.get("/")
def root():
    return {"message": "SEAS Exam Verification API v2.0 running", "status": "ok"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db_ok = False
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        print(f"Health check DB error: {e}")

    try:
        from deepface import DeepFace  # noqa
        face_ok = True
    except ImportError:
        face_ok = False

    tesseract_ok = os.path.isfile(settings.TESSERACT_CMD)

    health_status = "healthy" if db_ok and face_ok and tesseract_ok else "degraded"

    return {
        "status": health_status,
        "db_connected": db_ok,
        "face_service_up": face_ok,
        "ocr_service_up": tesseract_ok,
        "uptime_seconds": int(time.time() - APP_START_TIME),
    }


@app.get("/metrics")
def get_metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)