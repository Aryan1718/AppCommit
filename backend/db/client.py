import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_KEY")
    return create_client(url, service_key)


def get_resume_bucket() -> str:
    return os.getenv("SUPABASE_RESUME_BUCKET", "resumes")


supabase = get_supabase_client()
