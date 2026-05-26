import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Auto-create SQLite directory if needed
if settings.DATABASE_URL.startswith("sqlite:///"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    # Handle Windows absolute paths (sqlite:///C:/... becomes /C:/... after replace)
    if db_path.startswith("/") and len(db_path) > 2 and db_path[2] == ":":
        db_path = db_path[1:]
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    print(f"[DB] Using database at: {db_path}")

# CRITICAL FIX: check_same_thread=False required for SQLite under FastAPI
# (multiple threads share the same connection pool)
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()