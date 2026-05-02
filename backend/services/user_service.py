import os
import shutil
import uuid
from fastapi import HTTPException, UploadFile

from models import User, Follow
from repositories.user_repo import SQLUserRepository
from repositories.interfaces import IFollowRepository
from schema import UserUpdate


class UserService:
    """
    Single Responsibility: all user-related business logic —
    profile management, follow/unfollow, image upload, search.
    Depends on repository abstractions, not SQLAlchemy directly (DIP).
    """

    def __init__(self, user_repo: SQLUserRepository, follow_repo: IFollowRepository):
        self.user_repo = user_repo
        self.follow_repo = follow_repo

    # ── User reads ────────────────────────────────────────

    def get_by_id(self, user_id: str) -> User:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def get_by_username(self, username: str) -> dict:
        user = self.user_repo.get_by_username(username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "profile_pic": user.profile_pic,
        }

    def search(self, query: str) -> list:
        users = self.user_repo.search(query)
        return [
            {
                "id": u.id,
                "username": u.username,
                "name": u.full_name,
                "avatar": f"https://sda-app-backend.onrender.com{u.profile_pic}" if u.profile_pic else None,
            }
            for u in users
        ]

    # ── User writes ───────────────────────────────────────

    def update_user(self, user_id: str, updates: UserUpdate, current_user: User) -> dict:
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed to edit another user's profile")

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if updates.username and updates.username != user.username:
            if self.user_repo.get_by_username(updates.username):
                raise HTTPException(status_code=400, detail="Username already taken")

        for field in ("full_name", "username", "bio", "department", "university"):
            value = getattr(updates, field, None)
            if value is not None:
                setattr(user, field, value)

        updated = self.user_repo.update(user)
        return {
            "message": "Profile updated",
            "user": {
                "id": updated.id,
                "username": updated.username,
                "full_name": updated.full_name,
                "bio": updated.bio,
                "department": updated.department,
                "university": updated.university,
                "profile_pic": updated.profile_pic,
            },
        }

    def upload_profile_pic(self, user_id: str, file: UploadFile, current_user: User) -> dict:
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this profile")

        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image (jpg, png, etc.)")

        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{ext}"
        file_path = os.path.join("uploads/user_profile", filename)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception:
            raise HTTPException(status_code=500, detail="Could not save file")

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.profile_pic = f"/uploads/user_profile/{filename}"
        updated = self.user_repo.update(user)

        return {
            "message": "Profile picture updated successfully",
            "profile_pic": updated.profile_pic,
        }

    def delete_user(self, user_id: str, current_user: User, db) -> dict:
        """
        Cascades deletion of all related data.
        Accepts db directly for bulk deletes not covered by repo abstraction.
        """
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Not allowed to delete another user's account")

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from models import PostLike, Comment, Post, PostImage, Follow, ConversationParticipant, Message, Conversation

        db.query(PostLike).filter(PostLike.user_id == user_id).delete()
        db.query(Comment).filter(Comment.author_id == user_id).delete()

        user_posts = db.query(Post).filter(Post.author_id == user_id).all()
        for post in user_posts:
            db.query(PostImage).filter(PostImage.post_id == post.id).delete()
            db.query(PostLike).filter(PostLike.post_id == post.id).delete()
            db.query(Comment).filter(Comment.post_id == post.id).delete()
        db.query(Post).filter(Post.author_id == user_id).delete()

        db.query(Follow).filter(
            (Follow.follower_id == user_id) | (Follow.following_id == user_id)
        ).delete()

        participations = db.query(ConversationParticipant).filter(
            ConversationParticipant.user_id == user_id
        ).all()
        for p in participations:
            db.query(Message).filter(Message.conversation_id == p.conversation_id).delete()
            db.query(ConversationParticipant).filter(
                ConversationParticipant.conversation_id == p.conversation_id
            ).delete()
            db.query(Conversation).filter(Conversation.id == p.conversation_id).delete()

        db.delete(user)
        db.commit()

        return {"message": "Account deleted successfully"}

    # ── Follow ────────────────────────────────────────────

    def get_user_posts(self, user_id: str) -> list:
        from models import PostImage
        posts = self.user_repo.get_posts(user_id)
        return [
            {
                "id": post.id,
                "content": post.content,
                "created_at": post.created_at,
                "images": [
                    {"id": img.id, "image_url": img.image_url}
                    for img in self.follow_repo.db.query(PostImage)
                    .filter(PostImage.post_id == post.id)
                    .all()
                ],
            }
            for post in posts
        ]

    def follow(self, target_user_id: str, current_user: User) -> dict:
        if current_user.id == target_user_id:
            raise HTTPException(status_code=400, detail="You cannot follow yourself")

        if self.follow_repo.get(current_user.id, target_user_id):
            raise HTTPException(status_code=400, detail="Already following")

        follow = Follow(
            id=str(uuid.uuid4()),
            follower_id=current_user.id,
            following_id=target_user_id,
        )
        self.follow_repo.create(follow)
        return {"message": "Followed successfully"}

    def unfollow(self, target_user_id: str, current_user: User) -> dict:
        follow = self.follow_repo.get(current_user.id, target_user_id)
        if not follow:
            raise HTTPException(status_code=404, detail="Not following")

        self.follow_repo.delete(follow)
        return {"message": "Unfollowed successfully"}

    def get_followers(self, user_id: str) -> list:
        return [
            {"follower_id": f.follower_id, "following_id": f.following_id}
            for f in self.follow_repo.get_followers(user_id)
        ]

    def get_following(self, user_id: str) -> list:
        return [
            {"follower_id": f.follower_id, "following_id": f.following_id}
            for f in self.follow_repo.get_following(user_id)
        ]