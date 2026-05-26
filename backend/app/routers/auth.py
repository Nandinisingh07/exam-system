from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, UserRole
from ..utils.auth import verify_password, create_access_token, get_current_user, require_admin, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Map any alias the frontend might send → canonical UserRole value
_ROLE_ALIAS = {
    "admin":       UserRole.admin,
    "invigilator": UserRole.invigilator,
    "initiator":   UserRole.invigilator,  # frontend may call them "initiators"
    "teacher":     UserRole.invigilator,
    "student":     UserRole.student,
}


def _resolve_role(role_str: str) -> UserRole:
    """Convert a raw role string (any case) to a UserRole enum member."""
    key = (role_str or "invigilator").lower().strip()
    resolved = _ROLE_ALIAS.get(key)
    if resolved is None:
        raise HTTPException(status_code=422, detail=f"Invalid role '{role_str}'. Must be one of: admin, invigilator, student")
    return resolved


def _role_str(user: User) -> str:
    role = user.role
    return role.value if hasattr(role, "value") else str(role)


@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    try:
        if "application/json" in content_type:
            body = await request.json()
            email    = body.get("email") or body.get("username")
            password = body.get("password")
        else:
            form = await request.form()
            email    = form.get("username") or form.get("email")
            password = form.get("password")
    except Exception:
        raise HTTPException(status_code=400, detail="Request aborted or corrupt payload.")

    if not email or not password:
        raise HTTPException(status_code=422, detail="Email and password required")

    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact administrator.")

    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    role_val = _role_str(user)
    token = create_access_token({"sub": user.email, "role": role_val})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         role_val,
        "name":         user.name,
        "email":        user.email,
        "id":           user.id,
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":    current_user.id,
        "name":  current_user.name,
        "email": current_user.email,
        "role":  _role_str(current_user),
    }


@router.post("/register")
async def register_user(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin-only: create a new invigilator/admin/student account. Persists to DB permanently."""
    content_type = request.headers.get("content-type", "")
    try:
        if "application/json" in content_type:
            body = await request.json()
        else:
            form = await request.form()
            body = dict(form)
    except Exception:
        raise HTTPException(status_code=400, detail="Request aborted or corrupt payload.")

    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").lower().strip()
    password = body.get("password") or ""
    role_raw = body.get("role", "invigilator")

    # Validate required fields
    if not name:
        raise HTTPException(status_code=422, detail="'name' is required")
    if not email:
        raise HTTPException(status_code=422, detail="'email' is required")
    if not password or len(password) < 6:
        raise HTTPException(status_code=422, detail="'password' must be at least 6 characters")

    # Resolve role safely
    resolved_role = _resolve_role(role_raw)

    # Prevent duplicate email
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail=f"An account with email '{email}' already exists")

    new_user = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        role=resolved_role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "id":      new_user.id,
        "name":    new_user.name,
        "email":   new_user.email,
        "role":    _role_str(new_user),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id":         u.id,
            "name":       u.name,
            "email":      u.email,
            "role":       _role_str(u),
            "is_active":  u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: update name, password, role, or active status of any user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if "name" in body and body["name"].strip():
        u.name = body["name"].strip()

    if "password" in body:
        pw = body["password"]
        if len(pw) < 6:
            raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
        u.hashed_password = hash_password(pw)

    if "role" in body:
        u.role = _resolve_role(body["role"])

    if "is_active" in body:
        # Prevent admin from deactivating themselves
        if u.email == admin.email and not body["is_active"]:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account")
        u.is_active = bool(body["is_active"])

    db.commit()
    db.refresh(u)
    return {
        "message":   "User updated successfully",
        "id":        u.id,
        "name":      u.name,
        "email":     u.email,
        "role":      _role_str(u),
        "is_active": u.is_active,
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.email == admin.email:
        raise HTTPException(status_code=400, detail="Cannot delete currently logged-in administrator")
    db.delete(u)
    db.commit()
    return {"message": "User deleted successfully"}