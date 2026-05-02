from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from models import User
from schema import UserUpdate
from services.user_service import UserService
from dependencies import get_current_user, get_user_service
from database import get_db

# routes/users.py  
router = APIRouter(prefix="/users", tags=["users"])# then manually put /users/... back on each route decorator

@router.get("/id/{user_id}")
def get_user_by_id(
    user_id: str,
    service: UserService = Depends(get_user_service),
):
    return service.get_by_id(user_id)


@router.get("/username/{username}")
def get_user_by_username(
    username: str,
    service: UserService = Depends(get_user_service),
):
    return service.get_by_username(username)


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    updates: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    return service.update_user(user_id, updates, current_user)


@router.post("/{user_id}/upload-profile-pic")
async def upload_profile_pic(
    user_id: str,
    file: UploadFile = File(...),
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    return service.upload_profile_pic(user_id, file, current_user)


@router.get("/{user_id}/posts")
def get_user_posts(
    user_id: str,
    service: UserService = Depends(get_user_service),
):
    return service.get_user_posts(user_id)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.delete_user(user_id, current_user, db)


# ── Follow ────────────────────────────────────────────────

@router.post("/follow/{user_id}")
def follow_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    return service.follow(user_id, current_user)


@router.delete("/unfollow/{user_id}")
def unfollow_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    return service.unfollow(user_id, current_user)


@router.get("/{user_id}/followers")
def get_followers(
    user_id: str,
    service: UserService = Depends(get_user_service),
):
    return service.get_followers(user_id)


@router.get("/{user_id}/following")
def get_following(
    user_id: str,
    service: UserService = Depends(get_user_service),
):
    return service.get_following(user_id)


# ── Search ────────────────────────────────────────────────

@router.get("/search")
def search_users(
    query: str,
    service: UserService = Depends(get_user_service),
):
    return service.search(query)