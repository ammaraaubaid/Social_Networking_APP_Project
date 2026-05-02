import os
import shutil
import uuid
from datetime import datetime
from fastapi import HTTPException, UploadFile

from models import Post, PostImage, PostLike, Comment, User
from repositories.interfaces import IPostRepository, IUserRepository
from schema import CommentCreate


class PostService:
    """
    Single Responsibility: all post-related business logic —
    creating/editing/deleting posts, feed generation, likes, comments.
    Closed for modification: adding new post features extends this class,
    never rewrites existing methods (OCP).
    """

    def __init__(self, post_repo: IPostRepository, user_repo: IUserRepository):
        self.post_repo = post_repo
        self.user_repo = user_repo

    # ── Feed ──────────────────────────────────────────────

    def get_feed(self) -> list:
        posts = self.post_repo.get_all_ordered()
        result = []
        for p in posts:
            user = self.user_repo.get_by_id(p.author_id)
            images = self.post_repo.get_images(p.id)
            result.append({
                "id": str(p.id),
                "username": user.username if user else "unknown",
                "profile_pic": user.profile_pic if user else None,
                "content": p.content,
                "image": images[0].image_url if images else None,
                "images": [{"id": img.id, "image_url": img.image_url} for img in images],
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })
        return result

    # ── Post CRUD ─────────────────────────────────────────

    def create_post_with_image(
        self,
        content: str,
        current_user: User,
        file: UploadFile = None,
    ) -> dict:
        post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user.id,
            content=content,
            created_at=datetime.utcnow(),
        )
        self.post_repo.create(post)

        image_url = None
        if file and file.filename:
            image_url = self._save_image_file(file)
            self.post_repo.add_image(
                PostImage(id=str(uuid.uuid4()), post_id=post.id, image_url=image_url)
            )

        return {"message": "Post created", "post_id": post.id, "image": image_url}

    def create_post_multi_image(
        self,
        content: str,
        current_user: User,
        files: list[UploadFile],
    ) -> dict:
        post = Post(
            id=str(uuid.uuid4()),
            author_id=current_user.id,
            content=content,
        )
        self.post_repo.create(post)

        image_urls = []
        for file in files:
            if not file.content_type.startswith("image/"):
                continue
            image_url = self._save_image_file(file)
            self.post_repo.add_image(
                PostImage(id=str(uuid.uuid4()), post_id=post.id, image_url=image_url)
            )
            image_urls.append(image_url)

        return {"message": "Post created", "post_id": post.id, "images": image_urls}

    def edit_post(
        self,
        post_id: str,
        content: str,
        current_user: User,
        file: UploadFile = None,
        remove_image: bool = False,
    ) -> dict:
        post = self._get_owned_post(post_id, current_user)
        post.content = content

        if remove_image:
            self.post_repo.delete_images(post_id)

        if file and file.filename:
            self.post_repo.delete_images(post_id)
            image_url = self._save_image_file(file)
            self.post_repo.add_image(
                PostImage(id=str(uuid.uuid4()), post_id=post_id, image_url=image_url)
            )

        self.post_repo.update(post)
        return {"message": "Post updated"}

    def delete_post(self, post_id: str, current_user: User) -> dict:
        post = self._get_owned_post(post_id, current_user)
        self.post_repo.delete_images(post_id)

        # bulk delete likes and comments via db directly via repo
        from models import PostLike, Comment
        # handled in repo's delete — cascades defined in models
        self.post_repo.delete(post)
        return {"message": "Post deleted"}

    # ── Likes ─────────────────────────────────────────────

    def like_post(self, post_id: str, current_user: User) -> dict:
        if self.post_repo.get_like(post_id, current_user.id):
            raise HTTPException(status_code=400, detail="Already liked")

        self.post_repo.add_like(
            PostLike(id=str(uuid.uuid4()), post_id=post_id, user_id=current_user.id)
        )
        return {"message": "Post liked"}

    def unlike_post(self, post_id: str, current_user: User) -> dict:
        like = self.post_repo.get_like(post_id, current_user.id)
        if not like:
            raise HTTPException(status_code=404, detail="Not liked yet")

        self.post_repo.remove_like(like)
        return {"message": "Unliked"}

    def get_likes(self, post_id: str) -> dict:
        return {"post_id": post_id, "likes": self.post_repo.count_likes(post_id)}

    # ── Comments ──────────────────────────────────────────

    def create_comment(self, post_id: str, data: CommentCreate, current_user: User) -> dict:
        comment = Comment(
            id=str(uuid.uuid4()),
            post_id=post_id,
            author_id=current_user.id,
            content=data.content,
            parent_id=data.parent_id,
        )
        comment = self.post_repo.add_comment(comment)
        return {
            "message": "Comment added",
            "comment": {
                "id": comment.id,
                "content": comment.content,
                "post_id": comment.post_id,
                "author_id": comment.author_id,
                "parent_id": comment.parent_id,
                "created_at": comment.created_at,
            },
        }

    def get_comments(self, post_id: str) -> list:
        return [
            {
                "id": c.id,
                "content": c.content,
                "author_id": c.author_id,
                "parent_id": c.parent_id,
                "created_at": c.created_at,
            }
            for c in self.post_repo.get_comments(post_id)
        ]

    def delete_comment(self, comment_id: str, current_user: User) -> dict:
        comment = self.post_repo.get_comment_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")

        if comment.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")

        self.post_repo.delete_comment(comment)
        return {"message": "Comment deleted"}

    # ── Private helpers ───────────────────────────────────

    def _get_owned_post(self, post_id: str, current_user: User) -> Post:
        post = self.post_repo.get_by_id(post_id)
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        return post

    @staticmethod
    def _save_image_file(file: UploadFile) -> str:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{ext}"
        path = f"uploads/posts/{filename}"

        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return f"/uploads/posts/{filename}"