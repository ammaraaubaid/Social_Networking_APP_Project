from typing import Optional, List
from sqlalchemy.orm import Session
from models import Conversation, ConversationParticipant, Message, Follow, User
from .interfaces import IChatRepository


class SQLChatRepository(IChatRepository):

    def __init__(self, db: Session):
        self.db = db

    # ── Conversations ─────────────────────────────────────

    def get_conversation_by_id(self, conversation_id: str) -> Optional[Conversation]:
        return self.db.query(Conversation).filter(Conversation.id == conversation_id).first()

    def find_conversation_between(self, user_a: str, user_b: str) -> Optional[Conversation]:
        convos = (
            self.db.query(Conversation)
            .join(ConversationParticipant)
            .filter(ConversationParticipant.user_id == user_a)
            .all()
        )
        for convo in convos:
            participants = self.db.query(ConversationParticipant).filter(
                ConversationParticipant.conversation_id == convo.id
            ).all()
            participant_ids = {p.user_id for p in participants}
            if participant_ids == {user_a, user_b}:
                return convo
        return None

    def create_conversation(self, conversation: Conversation) -> Conversation:
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def add_participants(self, participants: List[ConversationParticipant]) -> None:
        self.db.add_all(participants)
        self.db.commit()

    def get_participant(self, conversation_id: str, user_id: str) -> Optional[ConversationParticipant]:
        return self.db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        ).first()

    def get_mutual_user_ids(self, user_id: str) -> List[str]:
        following = self.db.query(Follow).filter(Follow.follower_id == user_id).all()
        following_ids = {f.following_id for f in following}

        followers = self.db.query(Follow).filter(Follow.following_id == user_id).all()
        follower_ids = {f.follower_id for f in followers}

        return list(following_ids & follower_ids)

    def get_users_by_ids(self, user_ids: List[str]) -> List[User]:
        return self.db.query(User).filter(User.id.in_(user_ids)).all()

    # ── Messages ──────────────────────────────────────────

    def get_messages(self, conversation_id: str) -> List[Message]:
        return self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.created_at.asc()).all()

    def get_message_by_id(self, message_id: str) -> Optional[Message]:
        return self.db.query(Message).filter(Message.id == message_id).first()

    def add_message(self, message: Message) -> Message:
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def delete_message(self, message: Message) -> None:
        self.db.delete(message)
        self.db.commit()

    def update_message(self, message: Message) -> Message:
        self.db.commit()
        self.db.refresh(message)
        return message