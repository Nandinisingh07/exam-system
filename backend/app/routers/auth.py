from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.user import User
from ..utils.auth import verify_password, create_access_token, hash_password, require_admin, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginSchema(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(credentials: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email, "role": user.role})
    from ..utils import metrics
    metrics.ACTIVE_SESSIONS.inc()
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }

@router.post("/register")
def register_user(
    name: str,
    email: str,
    password: str,
    role: str = "invigilator",
    db: Session = Depends(get_db),
    #_: User = Depends(require_admin)
):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    new_user = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered", "id": new_user.id}

@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]