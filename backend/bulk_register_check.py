import sys, os
os.chdir(r'C:\Users\Nandini singh\exam-system\backend')
sys.path.insert(0, '.')

from app.database import SessionLocal
from app.models import Student
import pickle, numpy as np

db = SessionLocal()
students = db.query(Student).all()
print(f"Total students: {len(students)}")
print()

registered = []
unregistered = []

for s in students:
    if s.face_encoding:
        try:
            enc = pickle.loads(s.face_encoding)
            arr = np.array(enc)
            if arr.shape == (512,):
                registered.append(s)
            else:
                unregistered.append((s, f"wrong shape {arr.shape}"))
        except Exception as e:
            unregistered.append((s, str(e)))
    else:
        unregistered.append((s, "no encoding"))

print(f"✅ Registered ({len(registered)}):")
for s in registered:
    print(f"   {s.name} — {s.enrollment_no}")

print(f"\n❌ Need registration ({len(unregistered)}):")
for s, reason in unregistered:
    print(f"   {s.name} — {s.enrollment_no} [{reason}]")

db.close()