from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text
from database import Base


class Stereogram(Base):
    __tablename__ = "stereograms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    background_pattern = Column(String, nullable=False)
    hidden_object = Column(String, nullable=False)
    theme = Column(String, nullable=False)
    post_number = Column(Integer, nullable=False)
    scheduled_date = Column(Date, nullable=False)
    status = Column(String, default="not_started", nullable=False)
    image_filename = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    depth_map_url = Column(String, nullable=True)
    depth_intensity = Column(Float, default=0.35)
    color_mode = Column(String, default="random")
    dot_density = Column(Integer, default=5)
    hidden_object_type = Column(String, default="image")  # "text" or "image"
    content_type = Column(String, default="stereogram", server_default="stereogram")  # "stereogram" or "illusion"
    captions = Column(Text, nullable=True)  # JSON-serialised caption variations
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RescueReel(Base):
    __tablename__ = "rescue_reels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scene = Column(Text, nullable=False)
    style = Column(String, default="natural")           # "natural" | "cctv"
    status = Column(String, default="draft")            # "draft" | "images_done" | "videos_done" | "completed"

    # JSON-serialised lists / dicts stored as text
    image_prompts = Column(Text, nullable=True)         # JSON array [str, str, str]
    video_prompts = Column(Text, nullable=True)         # JSON array [str, str]
    caption = Column(Text, nullable=True)

    image_urls = Column(Text, nullable=True)            # JSON array [str, str, str]
    video_url_1 = Column(String, nullable=True)
    video_url_2 = Column(String, nullable=True)
    final_video_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
