"""
Notification service for Sicredi Guardião V2.

Handles:
  - Creating notifications for associates
  - SSE event broadcasting (in-memory for single-process SQLite MVP)
  - Polling fallback
"""
import asyncio
import logging
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory SSE subscriber registry
# ---------------------------------------------------------------------------
# Maps user_id -> list of asyncio.Queue instances (one per open SSE connection).
# This works for single-process deployments (SQLite / development).
_subscribers: dict[int, list[asyncio.Queue]] = {}


def subscribe(user_id: int) -> asyncio.Queue:
    """Register a new SSE subscriber for a user. Returns their event queue."""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.setdefault(user_id, []).append(q)
    return q


def unsubscribe(user_id: int, queue: asyncio.Queue) -> None:
    """Remove a subscriber queue when the connection closes."""
    queues = _subscribers.get(user_id, [])
    if queue in queues:
        queues.remove(queue)
    if not queues:
        _subscribers.pop(user_id, None)


def push_event(user_id: int, event_type: str, data: dict) -> None:
    """
    Push a SSE event to all open connections for a user.
    Safe to call from sync code — puts into queue without awaiting.
    """
    import json
    queues = _subscribers.get(user_id, [])
    payload = json.dumps({"type": event_type, "data": data})
    for q in list(queues):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            logger.warning("SSE queue full for user %s — dropping event", user_id)


async def event_stream(user_id: int, queue: asyncio.Queue) -> AsyncIterator[str]:
    """
    Async generator that yields SSE-formatted strings for one connection.
    """
    import json
    # Send an initial connection-confirmed event
    yield f"data: {json.dumps({'type': 'connected', 'data': {'user_id': user_id}})}\n\n"

    try:
        while True:
            try:
                # Wait up to 25 s for an event; send a heartbeat if nothing arrives
                payload = await asyncio.wait_for(queue.get(), timeout=25.0)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unsubscribe(user_id, queue)
