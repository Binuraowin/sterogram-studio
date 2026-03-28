from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime
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
    depth_intensity = Column(Float, default=0.35)
    color_mode = Column(String, default="random")
    dot_density = Column(Integer, default=5)
    hidden_object_type = Column(String, default="image")  # "text" or "image"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
