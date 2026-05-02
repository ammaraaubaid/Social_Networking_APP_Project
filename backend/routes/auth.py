from fastapi import APIRouter, Depends, Form
from schema import TokenPair, UserCreate
from services.auth_service import AuthService
from dependencies import get_auth_service

router = APIRouter(tags=["auth"])


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


@router.post("/forgot-password")
def forgot_password(
    email: str = Form(...),
    service: AuthService = Depends(get_auth_service),
):
    return service.forgot_password(email)


@router.post("/reset-password")
def reset_password(
    token: str = Form(...),
    new_password: str = Form(...),
    service: AuthService = Depends(get_auth_service),
):
    return service.reset_password(token, new_password)