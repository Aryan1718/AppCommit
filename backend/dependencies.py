import asyncio

from fastapi import Header, HTTPException, status

from db.client import supabase
from models.schemas import UserIdentity


async def get_current_user(authorization: str = Header(...)) -> UserIdentity:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must use Bearer token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        user_response = await asyncio.to_thread(supabase.auth.get_user, token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = getattr(user_response, "user", None)
    if user is None or getattr(user, "id", None) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify authenticated user",
        )

    return UserIdentity(id=user.id, email=getattr(user, "email", None))
