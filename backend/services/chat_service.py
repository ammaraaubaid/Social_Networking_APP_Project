import uuid
from fastapi import HTTPException

from models import User, Conversation, ConversationParticipant, Message
from repositories.interfaces import IChatRepository
from schema import MessageUpdate


class ChatService:
    """
    Single Responsibility: all chat/messaging business logic —
    conversation creation (idempotent), participant verification,
    message sending/editing/deleting, mutual-follow chat list.
    """

    def __init__(self, chat_repo: IChatRepository):
        self.chat_repo = chat_repo

    # ── Chat list ─────────────────────────────────────────

    def get_chats(self, current_user: User) -> list:
        mutual_ids = self.chat_repo.get_mutual_user_ids(current_user.id)
        if not mutual_ids:
            return []

        users = self.chat_repo.get_users_by_ids(mutual_ids)
        return [
            {
                "user_id": user.id,
                "username": user.username,
                "profile_pic": f"http://127.0.0.1:8000{user.profile_pic}" if user.profile_pic else None,
                "last_message": "Start chatting 👋",
                "timestamp": None,
            }
            for user in users
        ]

    # ── Conversations ─────────────────────────────────────

    def create_or_get_conversation(self, other_user_id: str, current_user: User) -> dict:
        if current_user.id == other_user_id:
            raise HTTPException(status_code=400, detail="Cannot create conversation with yourself")

        existing = self.chat_repo.find_conversation_between(current_user.id, other_user_id)
        if existing:
            return {"conversation_id": existing.id}

        conversation = Conversation(id=str(uuid.uuid4()))
        self.chat_repo.create_conversation(conversation)

        self.chat_repo.add_participants([
            ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conversation.id,
                user_id=current_user.id,
            ),
            ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conversation.id,
                user_id=other_user_id,
            ),
        ])

        return {"conversation_id": conversation.id}

    # ── Messages ──────────────────────────────────────────

    def get_messages(self, conversation_id: str, current_user: User) -> list:
        self._assert_participant(conversation_id, current_user.id)

        return [
            {
                "id": m.id,
                "content": m.content,
                "sender_id": m.sender_id,
                "created_at": m.created_at,
            }
            for m in self.chat_repo.get_messages(conversation_id)
        ]

    def send_message(self, conversation_id: str, content: str, current_user: User) -> dict:
        self._assert_participant(conversation_id, current_user.id)

        if not content or not content.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            sender_id=current_user.id,
            content=content.strip(),
        )
        msg = self.chat_repo.add_message(msg)
        return {
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "created_at": msg.created_at,
        }

    def update_message(self, message_id: str, body: MessageUpdate, current_user: User) -> Message:
        message = self.chat_repo.get_message_by_id(message_id)
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if str(message.sender_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not allowed to edit this message")

        message.content = body.content
        message.edited = True
        return self.chat_repo.update_message(message)

    def delete_message(self, message_id: str, current_user: User) -> dict:
        message = self.chat_repo.get_message_by_id(message_id)
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if str(message.sender_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not allowed to delete this message")

        self.chat_repo.delete_message(message)
        return {"message": "Message deleted successfully"}

    # ── Private helpers ───────────────────────────────────

    def _assert_participant(self, conversation_id: str, user_id: str) -> None:
        participant = self.chat_repo.get_participant(conversation_id, user_id)
        if not participant:
            raise HTTPException(status_code=403, detail="Not a participant")