from fastapi import APIRouter, Depends, Form
from schema import TokenPair, UserCreate
from services.auth_service import AuthService
from dependencies import get_auth_service

# routes/auth.py
router = APIRouter(tags=["auth"])  # remove prefix="/auth"

@router.post("/signup")
def signup(
    user: UserCreate,
    service: AuthService = Depends(get_auth_service),
):
    return service.signup(user)


@router.post("/login", response_model=TokenPair)
def login(
    username: str = Form(...),
    password: str = Form(...),
    service: AuthService = Depends(get_auth_service),
):
    return service.login(username, password)


@router.post("/refresh", response_model=TokenPair)
def refresh(
    refresh_token: str,
    service: AuthService = Depends(get_auth_service),
):
    return service.refresh(refresh_token)