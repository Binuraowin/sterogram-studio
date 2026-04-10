import csv
import io
import os
import time
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Stereogram
from schemas import StereogramResponse, StereogramUpdate, StereogramCreate
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

        width, height = 1200, 800

        os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
        filename = f"stereogram_{stereogram_id}.png"
        filepath = os.path.join(GENERATED_IMAGES_DIR, filename)

        content_type = item.content_type or "stereogram"

        if content_type == "illusion":
            # Generate silhouette only — user uploads this to IllusionDiffusion
            from PIL import Image as PILImage
            from services.sirds import generate_depth_map
            depth_arr = generate_depth_map(
                item.hidden_object, width, height, item.hidden_object_type or "image"
            )
            import numpy as np
            silhouette_pil = PILImage.fromarray((depth_arr * 255).astype(np.uint8)).convert("RGB")
            silhouette_pil.save(filepath, "PNG")
            depth_map_img = None
            print(f"[Illusion] silhouette saved for: {item.hidden_object}")
        else:
            params = {
                "hidden_object": item.hidden_object,
                "hidden_object_type": item.hidden_object_type or "image",
                "background_pattern": item.background_pattern,
                "width": width,
                "height": height,
                "depth_intensity": item.depth_intensity,
                "dot_density": item.dot_density,
                "color_mode": item.color_mode,
            }
            img, depth_map_img = generate_stereogram(params)
            img.save(filepath, "PNG")

        # Upload main image to Supabase if configured, otherwise serve locally
        from services.storage import is_available as storage_available, upload_image
        if storage_available():
            try:
                public_url = upload_image(filepath, filename)
                item.image_url = public_url
                os.remove(filepath)
                print(f"[Supabase] Uploaded and removed local {filename}")
            except Exception as e:
                print(f"[Supabase] Upload failed, serving locally: {e}")
                item.image_url = f"/static/{filename}?v={int(time.time())}"
        else:
            item.image_url = f"/static/{filename}?v={int(time.time())}"

        # Save depth map only for stereograms
        if depth_map_img is not None:
            depth_filename = f"depth_map_{stereogram_id}.png"
            depth_filepath = os.path.join(GENERATED_IMAGES_DIR, depth_filename)
            depth_map_img.save(depth_filepath, "PNG")
            if storage_available():
                try:
                    depth_url = upload_image(depth_filepath, depth_filename)
                    item.depth_map_url = depth_url
                    os.remove(depth_filepath)
                    print(f"[Supabase] Uploaded and removed local {depth_filename}")
                except Exception as e:
                    print(f"[Supabase] Depth map upload failed, serving locally: {e}")
                    item.depth_map_url = f"/static/{depth_filename}?v={int(time.time())}"
            else:
                item.depth_map_url = f"/static/{depth_filename}?v={int(time.time())}"

        item.image_filename = filename
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


# ── List ──────────────────────────────────────────────────────────────────────

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


# ── Create (single) ───────────────────────────────────────────────────────────

@router.post("", response_model=StereogramResponse, status_code=201)
def create_stereogram(payload: StereogramCreate, db: Session = Depends(get_db)):
    post_number = payload.post_number
    if post_number is None:
        max_num = db.query(func.max(Stereogram.post_number)).scalar() or 0
        post_number = max_num + 1

    item = Stereogram(
        background_pattern=payload.background_pattern,
        hidden_object=payload.hidden_object,
        hidden_object_type=payload.hidden_object_type,
        content_type=payload.content_type,
        theme=payload.theme,
        scheduled_date=payload.scheduled_date,
        depth_intensity=payload.depth_intensity,
        color_mode=payload.color_mode,
        dot_density=payload.dot_density,
        post_number=post_number,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ── CSV import ────────────────────────────────────────────────────────────────

@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    max_num = db.query(func.max(Stereogram.post_number)).scalar() or 0

    created = 0
    errors = []
    for i, row in enumerate(reader):
        try:
            max_num += 1
            item = Stereogram(
                background_pattern=row["background_pattern"].strip(),
                hidden_object=row["hidden_object"].strip(),
                hidden_object_type=row.get("hidden_object_type", "image").strip(),
                content_type=(row.get("content_type") or "stereogram").strip(),
                theme=row.get("theme", "General").strip(),
                scheduled_date=date.fromisoformat(row["scheduled_date"].strip()),
                depth_intensity=float(row.get("depth_intensity", 0.35)),
                color_mode=row.get("color_mode", "random").strip(),
                dot_density=int(row.get("dot_density", 5)),
                post_number=int(row["post_number"]) if row.get("post_number") else max_num,
            )
            db.add(item)
            created += 1
        except Exception as e:
            errors.append(f"Row {i + 2}: {e}")

    db.commit()
    return {"imported": created, "errors": errors}


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/{stereogram_id}", response_model=StereogramResponse)
def get_stereogram(stereogram_id: int, db: Session = Depends(get_db)):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")
    return item


# ── Update ────────────────────────────────────────────────────────────────────

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


# ── Generate / Regenerate ─────────────────────────────────────────────────────

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

    db_url = os.getenv("DATABASE_URL", "sqlite:///./stereogram_studio.db")
    background_tasks.add_task(do_generate, stereogram_id, db_url)
    return item


# ── Caption ───────────────────────────────────────────────────────────────────

@router.post("/{stereogram_id}/caption")
def generate_caption(stereogram_id: int, db: Session = Depends(get_db)):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")

    from services.caption_generator import generate_captions
    try:
        captions = generate_captions(item.hidden_object, item.background_pattern)
        return captions
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {e}")


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/{stereogram_id}/download")
def download_stereogram(stereogram_id: int, db: Session = Depends(get_db)):
    item = db.query(Stereogram).filter(Stereogram.id == stereogram_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stereogram not found")
    if not item.image_url:
        raise HTTPException(status_code=404, detail="Image not generated yet")

    # If stored in Supabase, redirect to the public URL
    if item.image_url.startswith("http"):
        return RedirectResponse(url=item.image_url)

    # Local fallback
    if not item.image_filename:
        raise HTTPException(status_code=404, detail="Image not found")
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
