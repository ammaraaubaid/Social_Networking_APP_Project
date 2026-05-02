from typing import Optional, List
from sqlalchemy.orm import Session
from models import User, Post, PostImage
from .interfaces import IUserRepository


class SQLUserRepository(IUserRepository):

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()

    def get_posts(self, user_id: str) -> List[Post]:
        return self.db.query(Post).filter(Post.author_id == user_id).all()

    def search(self, query: str) -> List[User]:
        from sqlalchemy import or_
        return self.db.query(User).filter(
            or_(
                User.username.ilike(f"%{query}%"),
                User.full_name.ilike(f"%{query}%"),
            )
        ).all()