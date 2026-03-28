import os
import time
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Stereogram
from schemas import StereogramResponse, StereogramUpdate
from services.sirds import generate_stereogram

router = APIRouter()

GENERATED_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "generated_images")


def do_generate(stereogram_id: int, db_url: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
        if not item:
            return

        size_map = {"800x600": (800, 600), "1200x800": (1200, 800), "1920x1080": (1920, 1080)}
        width, height = 1200, 800

        params = {
            "hidden_object": item.hidden_object,
            "background_pattern": item.background_pattern,
            "width": width,
            "height": height,
            "depth_intensity": item.depth_intensity,
            "dot_density": item.dot_density,
            "color_mode": item.color_mode,
        }

        img = generate_stereogram(params)

        os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
        filename = f"stereogram_{stereogram_id}.png"
        filepath = os.path.join(GENERATED_IMAGES_DIR, filename)
        img.save(filepath, "PNG")

        item.image_filename = filename
        item.image_url = f"/static/{filename}?v={int(time.time())}"
        item.status = "generated"
        db.commit()
    except Exception as e:
        item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
        if item:
            item.status = "not_started"
            db.commit()
        raise e
    finally:
        db.close()


@router.get("", response_model=List[StereogramResponse])
def list_stereograms(
    date_filter: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Stereogram)
    if date_filter:
        try:
            d = date.fromisoformat(date_filter)
            query = query.filter(Stereogram.scheduled_date == d)
        except ValueError:
            pass
    if status:
        query = query.filter(Stereogram.status == status)
    return query.order_by(Stereogram.id).all()


@router.get("/{stereogram_id}", response_model=StereogramResponse)
def get_stereogram(stereogram_id: int, db: Session = Depends(get_db)):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")
    return item


@router.put("/{stereogram_id}", response_model=StereogramResponse)
def update_stereogram(
    stereogram_id: int,
    payload: StereogramUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.post("/{stereogram_id}/generate", response_model=StereogramResponse)
def generate(
    stereogram_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")

    if item.status == "generating":
        return item

    item.status = "generating"
    db.commit()
    db.refresh(item)

    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./stereogram_studio.db")
    background_tasks.add_task(do_generate, stereogram_id, db_url)

    return item


@router.post("/{stereogram_id}/regenerate", response_model=StereogramResponse)
def regenerate(
    stereogram_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")

    item.status = "generating"
    db.commit()
    db.refresh(item)

    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./stereogram_studio.db")
    background_tasks.add_task(do_generate, stereogram_id, db_url)

    return item


@router.get("/{stereogram_id}/download")
def download_stereogram(stereogram_id: int, db: Session = Depends(get_db)):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")
    if not item.image_filename:
        raise HTTPException(status_code=404, detail="Image not generated yet")

    filepath = os.path.join(GENERATED_IMAGES_DIR, item.image_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found")

    safe_pattern = item.background_pattern.replace(" ", "-").lower()
    download_name = f"magic-eye-{safe_pattern}-{stereogram_id}.png"

    return FileResponse(
        path=filepath,
        media_type="image/png",
        filename=download_name,
        headers={"Content-Disposition": f"attachment; filename={download_name}"}
    )
