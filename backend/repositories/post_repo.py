from typing import Optional, List
from sqlalchemy.orm import Session
from models import Post, PostImage, PostLike, Comment
from .interfaces import IPostRepository


class SQLPostRepository(IPostRepository):

    def __init__(self, db: Session):
        self.db = db

    # ── Post CRUD ─────────────────────────────────────────

    def get_by_id(self, post_id: str) -> Optional[Post]:
        return self.db.query(Post).filter(Post.id == post_id).first()

    def get_all_ordered(self) -> List[Post]:
        return self.db.query(Post).order_by(Post.created_at.desc()).all()

    def create(self, post: Post) -> Post:
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def update(self, post: Post) -> Post:
        self.db.commit()
        self.db.refresh(post)
        return post

    def delete(self, post: Post) -> None:
        self.db.delete(post)
        self.db.commit()

    # ── Images ────────────────────────────────────────────

    def get_images(self, post_id: str) -> List[PostImage]:
        return self.db.query(PostImage).filter(PostImage.post_id == post_id).all()

    def add_image(self, image: PostImage) -> PostImage:
        self.db.add(image)
        self.db.commit()
        self.db.refresh(image)
        return image

    def delete_images(self, post_id: str) -> None:
        self.db.query(PostImage).filter(PostImage.post_id == post_id).delete()
        self.db.commit()

    # ── Likes ─────────────────────────────────────────────

    def get_like(self, post_id: str, user_id: str) -> Optional[PostLike]:
        return self.db.query(PostLike).filter(
            PostLike.post_id == post_id,
            PostLike.user_id == user_id,
        ).first()

    def add_like(self, like: PostLike) -> PostLike:
        self.db.add(like)
        self.db.commit()
        return like

    def remove_like(self, like: PostLike) -> None:
        self.db.delete(like)
        self.db.commit()

    def count_likes(self, post_id: str) -> int:
        return self.db.query(PostLike).filter(PostLike.post_id == post_id).count()

    # ── Comments ──────────────────────────────────────────

    def get_comments(self, post_id: str) -> List[Comment]:
        return self.db.query(Comment).filter(Comment.post_id == post_id).all()

    def get_comment_by_id(self, comment_id: str) -> Optional[Comment]:
        return self.db.query(Comment).filter(Comment.id == comment_id).first()

    def add_comment(self, comment: Comment) -> Comment:
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def delete_comment(self, comment: Comment) -> None:
        self.db.delete(comment)
        self.db.commit()