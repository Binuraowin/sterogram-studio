import os
from datetime import date, datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()

from database import engine, SessionLocal, Base
from models import Stereogram
from routers.stereograms import router as stereograms_router
from routers.posts import router as posts_router

GENERATED_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generated_images")

SEED_DATA = [
    {"background_pattern": "Jester Hat Pattern",      "hidden_object": "GOTCHA! text",     "post_number": 1, "scheduled_date": date(2026, 4, 1), "theme": "April Fools"},
    {"background_pattern": "Confetti Explosion",       "hidden_object": "Mischievous imp",  "post_number": 2, "scheduled_date": date(2026, 4, 1), "theme": "April Fools"},
    {"background_pattern": "Checkerboard Warp",        "hidden_object": "Question mark",    "post_number": 3, "scheduled_date": date(2026, 4, 1), "theme": "April Fools"},
    {"background_pattern": "Swirling Hypnosis",        "hidden_object": "Smiling emoji",    "post_number": 4, "scheduled_date": date(2026, 4, 1), "theme": "April Fools"},
    {"background_pattern": "Broken Mirror Shards",     "hidden_object": "Cracked egg",      "post_number": 5, "scheduled_date": date(2026, 4, 1), "theme": "April Fools"},
    {"background_pattern": "Rubber Chicken Texture",   "hidden_object": "Rubber duck",      "post_number": 1, "scheduled_date": date(2026, 4, 2), "theme": "April Fools"},
    {"background_pattern": "Whoopee Cushion Pattern",  "hidden_object": "Fart cloud symbol","post_number": 2, "scheduled_date": date(2026, 4, 2), "theme": "April Fools"},
    {"background_pattern": "Googly Eyes",              "hidden_object": "Oversized glasses","post_number": 3, "scheduled_date": date(2026, 4, 2), "theme": "April Fools"},
    {"background_pattern": "Fake Spiderweb",           "hidden_object": "Cartoon spider",   "post_number": 4, "scheduled_date": date(2026, 4, 2), "theme": "April Fools"},
    {"background_pattern": "Water Droplet Splash",     "hidden_object": "Tiny fish",        "post_number": 5, "scheduled_date": date(2026, 4, 2), "theme": "April Fools"},
]


def run_migrations(db: Session):
    """Add any missing columns to existing tables."""
    migrations = [
        "ALTER TABLE stereograms ADD COLUMN hidden_object_type VARCHAR DEFAULT 'image'",
        "ALTER TABLE stereograms ADD COLUMN depth_map_url VARCHAR",
        "ALTER TABLE stereograms ADD COLUMN content_type VARCHAR DEFAULT 'stereogram'",
    ]
    for sql in migrations:
        try:
            db.execute(__import__("sqlalchemy").text(sql))
            db.commit()
        except Exception:
            db.rollback()  # column already exists — safe to ignore


def seed_database(db: Session):
    count = db.query(Stereogram).count()
    if count == 0:
        for row in SEED_DATA:
            item = Stereogram(**row)
            db.add(item)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_migrations(db)
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Stereogram Studio API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=GENERATED_IMAGES_DIR), name="static")

app.include_router(stereograms_router, prefix="/api/stereograms")
app.include_router(posts_router, prefix="/api/posts")


@app.get("/health")
def health():
    return {"status": "ok"}
