from typing import Optional, List
from sqlalchemy.orm import Session
from models import Follow
from .interfaces import IFollowRepository


class SQLFollowRepository(IFollowRepository):

    def __init__(self, db: Session):
        self.db = db

    def get(self, follower_id: str, following_id: str) -> Optional[Follow]:
        return self.db.query(Follow).filter(
            Follow.follower_id == follower_id,
            Follow.following_id == following_id,
        ).first()

    def create(self, follow: Follow) -> Follow:
        self.db.add(follow)
        self.db.commit()
        return follow

    def delete(self, follow: Follow) -> None:
        self.db.delete(follow)
        self.db.commit()

    def get_followers(self, user_id: str) -> List[Follow]:
        return self.db.query(Follow).filter(Follow.following_id == user_id).all()

    def get_following(self, user_id: str) -> List[Follow]:
        return self.db.query(Follow).filter(Follow.follower_id == user_id).all()