from fastapi import APIRouter, Depends, File, UploadFile, Form

from models import User
from schema import CommentCreate
from services.post_service import PostService
from dependencies import get_current_user, get_post_service

router = APIRouter(tags=["posts"])


# ── Feed ──────────────────────────────────────────────────

@router.get("/feed")
def feed(service: PostService = Depends(get_post_service)):
    return service.get_feed()


# ── Post CRUD ─────────────────────────────────────────────

@router.post("/post-with-image")
def create_post_with_image(
    content: str = Form(...),
    file: UploadFile = File(None),
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.create_post_with_image(content, current_user, file)


@router.post("/posts")
async def create_post_multi(
    content: str,
    files: list[UploadFile] = File(...),
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.create_post_multi_image(content, current_user, files)


@router.patch("/posts/{post_id}")
async def edit_post(
    post_id: str,
    content: str = Form(...),
    file: UploadFile = File(None),
    remove_image: bool = Form(False),
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.edit_post(post_id, content, current_user, file, remove_image)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: str,
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.delete_post(post_id, current_user)


# ── Likes ─────────────────────────────────────────────────

@router.post("/posts/{post_id}/like")
def like_post(
    post_id: str,
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.like_post(post_id, current_user)


@router.delete("/posts/{post_id}/like")
def unlike_post(
    post_id: str,
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.unlike_post(post_id, current_user)


@router.get("/posts/{post_id}/likes")
def get_likes(
    post_id: str,
    service: PostService = Depends(get_post_service),
):
    return service.get_likes(post_id)


# ── Comments ──────────────────────────────────────────────

@router.post("/posts/{post_id}/comment")
def create_comment(
    post_id: str,
    comment: CommentCreate,
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.create_comment(post_id, comment, current_user)


@router.get("/posts/{post_id}/comments")
def get_comments(
    post_id: str,
    service: PostService = Depends(get_post_service),
):
    return service.get_comments(post_id)


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    service: PostService = Depends(get_post_service),
    current_user: User = Depends(get_current_user),
):
    return service.delete_comment(comment_id, current_user)