from fastapi import APIRouter, Depends

from dependencies import get_current_user


router = APIRouter()


@router.get("/me")
async def get_me(user=Depends(get_current_user)) -> dict[str, str | bool | None]:
    return {
        "id": str(user.id),
        "email": user.email,
        "authenticated": True,
    }
