"""
Guardião AI Chat API for Sicredi Guardião V2.

Endpoints:
  GET  /ai/status                         — AI provider health check
  POST /ai/sessions                       — create or retrieve a chat session for a transaction
  POST /ai/sessions/free                  — create a free-form chat session
  PATCH /ai/sessions/{id}/rename          — rename a session
  DELETE /ai/sessions/{id}                — delete a session
  POST /ai/sessions/{id}/message          — send a message (non-streaming)
  GET  /ai/sessions/{id}/stream           — send a message and stream the response (SSE)
  GET  /ai/sessions/{id}/messages         — get conversation history
  GET  /ai/sessions                       — list analyst's sessions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.database import get_db
from app.models.models import ChatMessage, ChatSession, User, UserRole
from app.services.ai_chat_service import (
    check_ai_status,
    check_ollama_status,
    create_free_session,
    delete_session,
    get_or_create_session,
    rename_session,
    send_message,
    stream_message,
)

router = APIRouter(prefix="/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# AI status
# ---------------------------------------------------------------------------

@router.get("/status")
def get_ai_status():
    """
    Check AI provider availability. Does not require authentication.
    Returns: status, provider, model, and optional message.
    Status values: available | unavailable | unconfigured | quota_exceeded | error
    """
    return check_ai_status()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.post("/sessions")
def create_or_get_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Create or retrieve a Guardião AI chat session for a transaction.
    Validates wallet access.
    """
    transaction_id = payload.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=422, detail="transaction_id é obrigatório.")

    try:
        session, is_new = get_or_create_session(db, current_user, transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {
        "session_id": session.id,
        "transaction_id": session.transaction_id,
        "title": session.title,
        "is_new": is_new,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "message_count": len(session.messages),
    }


@router.post("/sessions/free")
def create_free_chat_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Create a free-form chat session without a specific transaction."""
    session = create_free_session(db, current_user)
    return {
        "session_id": session.id,
        "title": session.title,
        "is_new": True,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "message_count": 0,
    }


@router.patch("/sessions/{session_id}/rename")
def rename_chat_session(
    session_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Rename a chat session."""
    title = payload.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Título não pode ser vazio.")
    try:
        session = rename_session(db, current_user, session_id, title)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"session_id": session.id, "title": session.title}


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Delete a chat session and its messages."""
    try:
        delete_session(db, current_user, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"message": "Sessão excluída com sucesso."}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@router.post("/sessions/{session_id}/message")
def post_message(
    session_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Send a message to the Guardião AI and get a response (non-streaming)."""
    message = payload.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Mensagem não pode ser vazia.")
    if len(message) > 2000:
        raise HTTPException(status_code=422, detail="Mensagem muito longa (máx 2000 caracteres).")

    try:
        reply, provider = send_message(db, current_user, session_id, message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {"reply": reply, "provider": provider}


@router.get("/sessions/{session_id}/stream")
async def stream_chat_message(
    session_id: int,
    message: str = Query(..., description="User message to send"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """
    Stream a Guardião AI response via Server-Sent Events (SSE).
    The message is passed as a query parameter for SSE compatibility.
    """
    if not message.strip():
        raise HTTPException(status_code=422, detail="Mensagem não pode ser vazia.")
    if len(message) > 2000:
        raise HTTPException(status_code=422, detail="Mensagem muito longa (máx 2000 caracteres).")

    async def generate():
        async for chunk in stream_message(db, current_user, session_id, message):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """Get all messages in a chat session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    if session.analyst_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
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
        if m.role.value != "system"  # never expose system messages
    ]


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.analyst, UserRole.admin)),
):
    """List analyst's chat sessions."""
    query = db.query(ChatSession)
    if current_user.role != UserRole.admin:
        query = query.filter(ChatSession.analyst_id == current_user.id)

    sessions = query.order_by(ChatSession.created_at.desc()).limit(30).all()
    return [
        {
            "id": s.id,
            "transaction_id": s.transaction_id,
            "title": s.title or "Análise",
            "message_count": len(s.messages),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
