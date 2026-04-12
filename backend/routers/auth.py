from fastapi import APIRouter


router = APIRouter()


@router.get("/me")
async def get_me() -> dict[str, str | bool | None]:
    return {
        "mode": "workspace",
        "authenticated": True,
        "requires_login": False,
    }
