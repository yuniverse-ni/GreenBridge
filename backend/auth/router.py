from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from .db import (
    get_user_by_email,
    get_user_by_id,
    create_user,
    update_last_login,
    to_safe_user,
)
from .security import (
    verify_password,
    create_access_token,
    verify_access_token,
)

router = APIRouter()


class LoginRequest(BaseModel):
    email: str = Field(..., description="User corporate email address")
    password: str = Field(..., description="Account password")


class RegisterRequest(BaseModel):
    email: str = Field(..., description="Corporate email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    name: str = Field(..., min_length=2, description="Full Name of the representative")
    title: Optional[str] = Field("Authorized Representative", description="Job title / designation")
    role: str = Field("sme_owner", description="Role: 'sme_owner' or 'finance_manager'")
    company_name: str = Field("Apex Precision Engineering Sdn Bhd", description="Registered Enterprise Name")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Dependency to validate Bearer JWT token and fetch active user from SQLite.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(payload.get("user_id", payload.get("id", "")))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return to_safe_user(user)


@router.post("/login")
def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(req.password, user["password_hash"], user["salt"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    update_last_login(user["id"])

    token_payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "company_name": user["company_name"],
    }
    access_token = create_access_token(token_payload)

    return {
        "success": True,
        "token": access_token,
        "user": to_safe_user(user),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    if req.role not in ("sme_owner", "finance_manager"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'sme_owner' or 'finance_manager'.",
        )

    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    try:
        new_user = create_user(
            email=req.email,
            password=req.password,
            name=req.name,
            title=req.title or "Authorized Representative",
            role=req.role,
            company_name=req.company_name,
        )

        token_payload = {
            "user_id": new_user["id"],
            "email": new_user["email"],
            "role": new_user["role"],
            "name": new_user["name"],
            "company_name": new_user["company_name"],
        }
        access_token = create_access_token(token_payload)

        return {
            "success": True,
            "token": access_token,
            "user": to_safe_user(new_user),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )


@router.get("/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "success": True,
        "user": current_user,
    }


@router.post("/logout")
def logout():
    return {
        "success": True,
        "message": "Logged out successfully.",
    }
