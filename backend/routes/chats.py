from fastapi import APIRouter, Depends

from models import User
from schema import MessageUpdate
from services.chat_service import ChatService
from dependencies import get_current_user, get_chat_service

router = APIRouter(tags=["chats"])


# ── Chat list ─────────────────────────────────────────────

@router.get("/chats")
def get_chats(
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.get_chats(current_user)


# ── Conversations ─────────────────────────────────────────

@router.post("/conversations/{other_user_id}")
def create_or_get_conversation(
    other_user_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.create_or_get_conversation(other_user_id, current_user)


# ── Messages ──────────────────────────────────────────────

@router.get("/messages/{conversation_id}")
def get_messages(
    conversation_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.get_messages(conversation_id, current_user)


@router.post("/messages/{conversation_id}")
def send_message(
    conversation_id: str,
    body: dict,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.send_message(conversation_id, body.get("content", ""), current_user)


@router.put("/messages/{message_id}")
def update_message(
    message_id: str,
    body: MessageUpdate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.update_message(message_id, body, current_user)


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    return service.delete_message(message_id, current_user)