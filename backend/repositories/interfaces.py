from abc import ABC, abstractmethod
from typing import Optional, List
from models import User, Post, PostImage, PostLike, Comment, Follow, Conversation, ConversationParticipant, Message


# ── IUserRepository ───────────────────────────────────────

class IUserRepository(ABC):

    @abstractmethod
    def get_by_id(self, user_id: str) -> Optional[User]: ...

    @abstractmethod
    def get_by_username(self, username: str) -> Optional[User]: ...

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    def create(self, user: User) -> User: ...

    @abstractmethod
    def update(self, user: User) -> User: ...

    @abstractmethod
    def delete(self, user: User) -> None: ...

    @abstractmethod
    def get_posts(self, user_id: str) -> List[Post]: ...


# ── IFollowRepository ─────────────────────────────────────

class IFollowRepository(ABC):

    @abstractmethod
    def get(self, follower_id: str, following_id: str) -> Optional[Follow]: ...

    @abstractmethod
    def create(self, follow: Follow) -> Follow: ...

    @abstractmethod
    def delete(self, follow: Follow) -> None: ...

    @abstractmethod
    def get_followers(self, user_id: str) -> List[Follow]: ...

    @abstractmethod
    def get_following(self, user_id: str) -> List[Follow]: ...


# ── IPostRepository ───────────────────────────────────────

class IPostRepository(ABC):

    @abstractmethod
    def get_by_id(self, post_id: str) -> Optional[Post]: ...

    @abstractmethod
    def get_all_ordered(self) -> List[Post]: ...

    @abstractmethod
    def create(self, post: Post) -> Post: ...

    @abstractmethod
    def update(self, post: Post) -> Post: ...

    @abstractmethod
    def delete(self, post: Post) -> None: ...

    @abstractmethod
    def get_images(self, post_id: str) -> List[PostImage]: ...

    @abstractmethod
    def add_image(self, image: PostImage) -> PostImage: ...

    @abstractmethod
    def delete_images(self, post_id: str) -> None: ...

    @abstractmethod
    def get_like(self, post_id: str, user_id: str) -> Optional[PostLike]: ...

    @abstractmethod
    def add_like(self, like: PostLike) -> PostLike: ...

    @abstractmethod
    def remove_like(self, like: PostLike) -> None: ...

    @abstractmethod
    def count_likes(self, post_id: str) -> int: ...

    @abstractmethod
    def get_comments(self, post_id: str) -> List[Comment]: ...

    @abstractmethod
    def get_comment_by_id(self, comment_id: str) -> Optional[Comment]: ...

    @abstractmethod
    def add_comment(self, comment: Comment) -> Comment: ...

    @abstractmethod
    def delete_comment(self, comment: Comment) -> None: ...


# ── IChatRepository ───────────────────────────────────────

class IChatRepository(ABC):

    @abstractmethod
    def get_conversation_by_id(self, conversation_id: str) -> Optional[Conversation]: ...

    @abstractmethod
    def find_conversation_between(self, user_a: str, user_b: str) -> Optional[Conversation]: ...

    @abstractmethod
    def create_conversation(self, conversation: Conversation) -> Conversation: ...

    @abstractmethod
    def add_participants(self, participants: List[ConversationParticipant]) -> None: ...

    @abstractmethod
    def get_participant(self, conversation_id: str, user_id: str) -> Optional[ConversationParticipant]: ...

    @abstractmethod
    def get_mutual_user_ids(self, user_id: str) -> List[str]: ...

    @abstractmethod
    def get_messages(self, conversation_id: str) -> List[Message]: ...

    @abstractmethod
    def get_message_by_id(self, message_id: str) -> Optional[Message]: ...

    @abstractmethod
    def add_message(self, message: Message) -> Message: ...

    @abstractmethod
    def delete_message(self, message: Message) -> None: ...

    @abstractmethod
    def update_message(self, message: Message) -> Message: ...