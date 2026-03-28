from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class StereogramBase(BaseModel):
    background_pattern: str
    hidden_object: str
    theme: str
    post_number: int
    scheduled_date: date
    depth_intensity: float = 0.35
    color_mode: str = "random"
    dot_density: int = 5


class StereogramCreate(StereogramBase):
    pass


class StereogramUpdate(BaseModel):
    background_pattern: Optional[str] = None
    hidden_object: Optional[str] = None
    theme: Optional[str] = None
    depth_intensity: Optional[float] = None
    color_mode: Optional[str] = None
    dot_density: Optional[int] = None


class StereogramResponse(StereogramBase):
    id: int
    status: str
    image_filename: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
