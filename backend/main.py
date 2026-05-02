import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
from routes import auth, users, posts, chats

# ── DB Init ───────────────────────────────────────────────

Base.metadata.create_all(bind=engine)

# ── App setup ─────────────────────────────────────────────

app = FastAPI(title="NU Connect API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────

os.makedirs("uploads/user_profile", exist_ok=True)
os.makedirs("uploads/posts", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(chats.router)