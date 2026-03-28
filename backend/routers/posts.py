from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Stereogram
from services.post_generator import (
    generate_post_content,
    publish_to_wordpress,
    is_wordpress_configured,
)

router = APIRouter()


class PostRequest(BaseModel):
    date: str
    status: str = "draft"  # "draft" or "publish"
    stereogram_ids: Optional[List[int]] = None  # if None, use all generated for the date


@router.post("/preview")
def preview_post(payload: PostRequest, db: Session = Depends(get_db)):
    try:
        post_date = date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    stereograms = (
        db.query(Stereogram)
        .filter(
            Stereogram.scheduled_date == post_date,
            Stereogram.status == "generated",
        )
        .order_by(Stereogram.post_number)
        .all()
    )

    if not stereograms:
        raise HTTPException(
            status_code=404,
            detail=f"No generated stereograms found for {payload.date}. Generate them first.",
        )

    # Filter to selected IDs if provided
    if payload.stereogram_ids:
        id_set = set(payload.stereogram_ids)
        stereograms = [s for s in stereograms if s.id in id_set]

    if not stereograms:
        raise HTTPException(status_code=400, detail="None of the selected stereograms are generated.")

    post = generate_post_content(stereograms, post_date)
    post["wordpress_configured"] = is_wordpress_configured()
    return post


@router.post("/publish")
def publish_post(payload: PostRequest, db: Session = Depends(get_db)):
    try:
        post_date = date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    stereograms = (
        db.query(Stereogram)
        .filter(
            Stereogram.scheduled_date == post_date,
            Stereogram.status == "generated",
        )
        .order_by(Stereogram.post_number)
        .all()
    )

    if not stereograms:
        raise HTTPException(
            status_code=404,
            detail=f"No generated stereograms found for {payload.date}.",
        )

    if payload.stereogram_ids:
        id_set = set(payload.stereogram_ids)
        stereograms = [s for s in stereograms if s.id in id_set]

    post = generate_post_content(stereograms, post_date)

    try:
        result = publish_to_wordpress(post["title"], post["content"], payload.status, stereograms)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WordPress publish failed: {e}")
