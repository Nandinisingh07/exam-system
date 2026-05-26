import sys, os
os.chdir(r"C:\Users\Nandini singh\exam-system\backend")
sys.path.insert(0, ".")

from app.database import SessionLocal
from app.services.face_service import load_embedding_cache, compare_faces_cached, COSINE_THRESHOLD
import pickle, numpy as np

db = SessionLocal()

# 1. Load cache manually
result = load_embedding_cache(db)
print(f"Cache loaded: {len(result)} students")

# 2. Simulate what verify does — get the stored embedding and compare to itself
from app.models import Student
s = db.query(Student).first()
stored = np.array(pickle.loads(s.face_encoding), dtype=np.float64)
stored /= np.linalg.norm(stored) + 1e-10

# Self-match (should be ~100%)
results = compare_faces_cached(stored, [s.id])
print(f"Self-match results: {results}")
print(f"COSINE_THRESHOLD: {COSINE_THRESHOLD}")

db.close()