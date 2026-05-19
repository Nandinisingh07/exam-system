from fastapi import FastAPI, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .routers import auth, students, verification, attendance, logistics, monitoring, admin, student_portal
from .config import settings
from .utils import metrics
import os, time

APP_START_TIME = time.time()

# Create / migrate tables (safe — only adds new columns via SQLAlchemy)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SEAS — Smart Examination Automated System",
    version="2.0.0",
    description="AI-powered Exam Verification with Face Recognition, OCR, and Confidence Engine"
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]

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
async def preload_ai_models():
    """Warm up DeepFace model on startup so first verification is fast."""
    try:
        import numpy as np
        import cv2
        import tempfile
        from deepface import DeepFace

        dummy = np.zeros((224, 224, 3), dtype=np.uint8)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            cv2.imwrite(tmp.name, dummy)
            try:
                DeepFace.represent(tmp.name, model_name="Facenet512", enforce_detection=False)
            except Exception:
                pass
            finally:
                if os.path.exists(tmp.name):
                    os.remove(tmp.name)
        print("[SEAS] Facenet512 model preloaded and ready.")
    except Exception as e:
        print(f"[SEAS] Model preload warning (non-fatal): {e}")


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
        from deepface import DeepFace
        face_ok = True
    except ImportError:
        face_ok = False

    tesseract_ok = os.path.isfile(settings.TESSERACT_CMD)

    status = "healthy" if db_ok and face_ok and tesseract_ok else "degraded"

    return {
        "status": status,
        "db_connected": db_ok,
        "face_service_up": face_ok,
        "ocr_service_up": tesseract_ok,
        "uptime_seconds": int(time.time() - APP_START_TIME),
    }


@app.get("/metrics")
def get_metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)