from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User
from services.auth_service import AuthService
from services.user_service import UserService
from services.post_service import PostService
from services.chat_service import ChatService
from repositories.user_repo import SQLUserRepository
from repositories.follow_repo import SQLFollowRepository
from repositories.post_repo import SQLPostRepository
from repositories.chat_repo import SQLChatRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Auth dependency ───────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = AuthService.decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = SQLUserRepository(db).get_by_id(payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ── Service factories (injected into routers via Depends) ─

def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(user_repo=SQLUserRepository(db))


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(
        user_repo=SQLUserRepository(db),
        follow_repo=SQLFollowRepository(db),
    )


def get_post_service(db: Session = Depends(get_db)) -> PostService:
    return PostService(
        post_repo=SQLPostRepository(db),
        user_repo=SQLUserRepository(db),
    )


def get_chat_service(db: Session = Depends(get_db)) -> ChatService:
    return ChatService(chat_repo=SQLChatRepository(db))