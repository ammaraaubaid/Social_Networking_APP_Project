import re
import uuid
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import User
from repositories.user_repo import SQLUserRepository
from schema import UserCreate


# ── Config ────────────────────────────────────────────────

SECRET_KEY = "fbab35ec4019c91b7d06cd19a0e7290ca81d7b6bed0ea43e1fdcfa7128e7c1f2"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

NU_EMAIL_REGEX = re.compile(r'^l\d{6}@lhr\.nu\.edu\.pk$', re.IGNORECASE)


class AuthService:
    """
    Single Responsibility: handles only authentication concerns —
    password hashing, token creation/decoding, email format validation, signup/login.
    """

    def __init__(self, user_repo: SQLUserRepository):
        self.user_repo = user_repo

    # ── Validation ────────────────────────────────────────

    def validate_nu_email_format(self, email: str) -> None:
        if not NU_EMAIL_REGEX.match(email):
            raise HTTPException(
                status_code=400,
                detail="Email must be in the format lXXXXXX@lhr.nu.edu.pk (e.g. l123456@lhr.nu.edu.pk)",
            )

    # ── Password ──────────────────────────────────────────

    @staticmethod
    def hash_password(password: str) -> str:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

    # ── Tokens ────────────────────────────────────────────

    @staticmethod
    def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def decode_access_token(token: str) -> dict | None:
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            return None

    @staticmethod
    def create_verification_token(email: str) -> str:
        expire = datetime.utcnow() + timedelta(hours=24)
        return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def decode_verification_token(token: str) -> str | None:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload.get("sub")
        except JWTError:
            return None

    # ── Auth Operations ───────────────────────────────────

    def signup(self, data: UserCreate) -> dict:
        self.validate_nu_email_format(data.email)

        if self.user_repo.get_by_username(data.username):
            raise HTTPException(status_code=400, detail="Username already exists")

        if self.user_repo.get_by_email(data.email):
            raise HTTPException(status_code=400, detail="Email already registered")

        new_user = User(
            id=str(uuid.uuid4()),
            username=data.username,
            email=data.email,
            password=self.hash_password(data.password),
            full_name=data.full_name,
            university=data.university,
            department=data.department,
            bio=data.bio,
        )

        try:
            self.user_repo.create(new_user)
        except Exception:
            raise HTTPException(status_code=500, detail="Database insertion failed")

        return {"message": "User created successfully"}

    def login(self, username: str, password: str) -> dict:
        user = self.user_repo.get_by_username(username)
        if not user or not self.verify_password(password, user.password):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        access_token = self.create_access_token(data={"sub": user.id})
        refresh_token = self.create_access_token(
            data={"sub": user.id}, expires_delta=timedelta(days=7)
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
        }

    def refresh(self, refresh_token: str) -> dict:
        payload = self.decode_access_token(refresh_token)
        if not payload or not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

        user = self.user_repo.get_by_id(payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return {
            "access_token": self.create_access_token(data={"sub": user.id}),
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def forgot_password(self, email: str) -> dict:
        user = self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email")

        token = self.create_verification_token(email)
        reset_link = f"http://127.0.0.1:8000/reset-password?token={token}"
        return {"message": "Password reset link generated", "reset_link": reset_link}

    def reset_password(self, token: str, new_password: str) -> dict:
        email = self.decode_verification_token(token)
        if not email:
            raise HTTPException(status_code=400, detail="Invalid or expired token")

        user = self.user_repo.get_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.password = self.hash_password(new_password)
        self.user_repo.update(user)
        return {"message": "Password reset successful"}