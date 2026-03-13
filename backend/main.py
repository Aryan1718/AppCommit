from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import applications, auth, parse_llm, resumes


app = FastAPI(title="AppCommit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(parse_llm.router, prefix="/api", tags=["llm"])


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
