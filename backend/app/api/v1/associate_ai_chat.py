"""
Associate AI Chat API for Sicredi Guardião V2.

Endpoints:
  POST /ai/associate/sessions               — create a new chat session
  GET  /ai/associate/sessions               — list associate's sessions
  DELETE /ai/associate/sessions/{id}        — delete a session
  POST /ai/associate/sessions/{id}/message  — send a message (non-streaming)
  GET  /ai/associate/sessions/{id}/stream   — stream a message (SSE)
  GET  /ai/associate/sessions/{id}/messages — get session message history
  POST /ai/associate/chat                   — stateless single-turn chat (legacy)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import AssociateChatMessage, AssociateChatSession, User, UserRole
from app.services.ai_chat_service import (
    get_or_create_associate_session,
    send_associate_message,
    stream_associate_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/associate", tags=["ai-associate"])


def _require_associate(current_user: User) -> User:
    if current_user.role not in (UserRole.associate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para associados.")
    return current_user


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.post("/sessions")
def create_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new associate chat session."""
    _require_associate(current_user)
    session = get_or_create_associate_session(db, current_user)
    return {
        "session_id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "message_count": 0,
    }


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List associate's chat sessions."""
    _require_associate(current_user)
    sessions = (
        db.query(AssociateChatSession)
        .filter(AssociateChatSession.user_id == current_user.id)
        .order_by(AssociateChatSession.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "message_count": len(s.messages),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an associate chat session."""
    _require_associate(current_user)
    session = db.query(AssociateChatSession).filter(
        AssociateChatSession.id == session_id,
        AssociateChatSession.user_id == current_user.id,
    ).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    db.query(AssociateChatMessage).filter(
        AssociateChatMessage.session_id == session_id
    ).delete()
    db.delete(session)
    db.commit()
    return {"message": "Sessão excluída com sucesso."}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/message")
def post_message(
    session_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message in an associate chat session (non-streaming)."""
    _require_associate(current_user)
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Mensagem não pode ser vazia.")
    if len(message) > 1000:
        raise HTTPException(status_code=422, detail="Mensagem muito longa (máx 1000 caracteres).")

    try:
        reply, provider = send_associate_message(db, current_user, session_id, message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"reply": reply, "provider": provider}


@router.get("/sessions/{session_id}/stream")
async def stream_session_message(
    session_id: int,
    message: str = Query(..., description="User message to send"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an associate AI response via Server-Sent Events."""
    _require_associate(current_user)
    if not message.strip():
        raise HTTPException(status_code=422, detail="Mensagem não pode ser vazia.")
    if len(message) > 1000:
        raise HTTPException(status_code=422, detail="Mensagem muito longa (máx 1000 caracteres).")

    async def generate():
        async for chunk in stream_associate_message(db, current_user, session_id, message):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get message history for an associate chat session."""
    _require_associate(current_user)
    session = db.query(AssociateChatSession).filter(
        AssociateChatSession.id == session_id,
        AssociateChatSession.user_id == current_user.id,
    ).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")

    messages = (
        db.query(AssociateChatMessage)
        .filter(AssociateChatMessage.session_id == session_id)
        .order_by(AssociateChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role.value,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
        if m.role.value != "system"
    ]


# ---------------------------------------------------------------------------
# Legacy stateless endpoint (kept for backward compatibility)
# ---------------------------------------------------------------------------

@router.post("/chat")
def associate_chat_legacy(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Legacy stateless single-turn chat endpoint.
    Creates a temporary session. Prefer /sessions/{id}/message for persistent conversations.
    """
    if current_user.role not in (UserRole.associate, UserRole.admin):
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para associados.")

    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Mensagem não pode ser vazia.")
    if len(message) > 1000:
        raise HTTPException(status_code=422, detail="Mensagem muito longa (máx 1000 caracteres).")

    session = get_or_create_associate_session(db, current_user)
    reply, provider = send_associate_message(db, current_user, session.id, message)
    return {"reply": reply, "provider": provider, "session_id": session.id}
