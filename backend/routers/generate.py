"""
/api/generate — Full content pipeline: stereogram → thumbnail → reel → captions.

The stereogram, thumbnail, and captions are generated synchronously (fast, <1s).
The reel video is generated in the background so the API returns immediately.
Poll /api/generate/status/{job_id} to check when the reel is ready.
"""

import os
import uuid
import threading
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import aiofiles
from pydantic import BaseModel
from typing import Optional

from services.sirds import generate_sirds_full
from services.thumbnail_maker import create_thumbnail
from services.reel_maker import create_reel
from services.caption_generator import generate_captions
from services.storage import is_available as storage_available, upload_image, upload_video

router = APIRouter()

GENERATED_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "generated_images")
GENERATED_VIDEOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "generated_videos")

# In-memory job status store (good enough for single-server local app)
_jobs: dict[str, dict] = {}


class GenerateRequest(BaseModel):
    subject: str = "dolphin"   # dolphin | heart | eagle | star
    palette: str = "rainbow"   # rainbow | ocean | forest | sunset | cosmic


class GenerateResponse(BaseModel):
    job_id: str
    stereogram_image: str       # URL, available immediately
    depth_map_image: str        # URL, available immediately
    pattern_image: str          # URL, available immediately
    thumbnail_image: str        # URL, available immediately
    reel_video: Optional[str] = None   # URL, None until reel is ready
    reel_status: str                   # "pending" | "ready" | "error"
    caption: dict                      # caption variations, available immediately


class StatusResponse(BaseModel):
    job_id: str
    reel_status: str
    reel_video: Optional[str] = None
    error: Optional[str] = None


def _maybe_upload_image(filepath: str, filename: str, static_path: str, delete: bool = True) -> str:
    """Upload to Supabase if configured, else return local static URL."""
    if storage_available():
        try:
            url = upload_image(filepath, filename)
            if delete:
                os.remove(filepath)
            print(f"[generate] Uploaded image to Supabase: {filename}")
            return url
        except Exception as e:
            print(f"[generate] Supabase upload failed for {filename}, serving locally: {e}")
    return static_path


def _maybe_upload_video(filepath: str, filename: str, static_path: str) -> str:
    """Upload video to Supabase if configured, else return local static URL. Deletes local file on success."""
    if storage_available():
        try:
            url = upload_video(filepath, filename)
            os.remove(filepath)
            print(f"[generate] Uploaded video to Supabase: {filename}")
            return url
        except Exception as e:
            print(f"[generate] Supabase video upload failed for {filename}, serving locally: {e}")
    return static_path


def _render_reel_bg(
    job_id: str,
    stereo_path: str, depth_path: str, pattern_path: str,
    reel_path: str, reel_filename: str,
    hook_text: str, instruction_text: str, cta_text: str,
    local_image_paths: list[str],
):
    """Background thread: render the reel, upload to Supabase, clean up local files."""
    try:
        create_reel(
            stereogram_path=stereo_path,
            depth_map_path=depth_path,
            pattern_path=pattern_path,
            output_path=reel_path,
            hook_text=hook_text,
            instruction_text=instruction_text,
            cta_text=cta_text,
        )
        # Upload reel video
        reel_url = _maybe_upload_video(
            reel_path,
            reel_filename,
            f"/static/videos/{reel_filename}",
        )
        # Clean up any local image files that were kept for reel rendering
        for path in local_image_paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
        _jobs[job_id] = {
            "status": "ready",
            "reel_video": reel_url,
            "error": None,
        }
        print(f"[generate] Reel ready: {reel_filename}")
    except Exception as e:
        _jobs[job_id] = {"status": "error", "reel_video": None, "error": str(e)}
        print(f"[generate] Reel error for job {job_id}: {e}")


@router.post("/api/generate", response_model=GenerateResponse)
def generate_content(request: GenerateRequest):
    """
    Generate a complete Magic Eye content package.
    Stereogram, thumbnail, and captions return immediately.
    Reel renders in the background — poll /api/generate/status/{job_id}.
    """
    valid_palettes = {"rainbow", "ocean", "forest", "sunset", "cosmic"}
    if request.palette not in valid_palettes:
        request.palette = "rainbow"

    os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    os.makedirs(GENERATED_VIDEOS_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    job_id = str(uuid.uuid4())[:8]

    stereo_filename    = f"stereogram_{timestamp}.png"
    depth_filename     = f"depth_{timestamp}.png"
    pattern_filename   = f"pattern_{timestamp}.png"
    thumbnail_filename = f"thumbnail_{timestamp}.png"
    reel_filename      = f"reel_{timestamp}.mp4"

    stereo_path    = os.path.join(GENERATED_IMAGES_DIR, stereo_filename)
    depth_path     = os.path.join(GENERATED_IMAGES_DIR, depth_filename)
    pattern_path   = os.path.join(GENERATED_IMAGES_DIR, pattern_filename)
    thumbnail_path = os.path.join(GENERATED_IMAGES_DIR, thumbnail_filename)
    reel_path      = os.path.join(GENERATED_VIDEOS_DIR, reel_filename)

    try:
        # ── Step 1: Stereogram + depth map + pattern (~0.2s)
        print(f"[generate] Stereogram: {request.subject} / {request.palette}")
        sirds_img, depth_img, pattern_img = generate_sirds_full(
            hidden_object=request.subject,
            palette=request.palette,
            width=1080,
            height=1080,
        )
        sirds_img.save(stereo_path, "PNG")
        depth_img.save(depth_path, "PNG")
        pattern_img.save(pattern_path, "PNG")

        # ── Step 2: Thumbnail (~0.05s)
        subject_cap = request.subject.title()
        hook_text   = f"Can you see the hidden {subject_cap}"
        create_thumbnail(stereo_path, thumbnail_path, hook_text)

        # ── Step 3: Upload images to Supabase (keep local copies for reel thread)
        # delete=False so reel background thread can still read the files from disk.
        # The thread will clean them up when it finishes rendering.
        stereo_url    = _maybe_upload_image(stereo_path,    stereo_filename,    f"/static/{stereo_filename}",    delete=False)
        depth_url     = _maybe_upload_image(depth_path,     depth_filename,     f"/static/{depth_filename}",     delete=False)
        pattern_url   = _maybe_upload_image(pattern_path,   pattern_filename,   f"/static/{pattern_filename}",   delete=False)
        thumbnail_url = _maybe_upload_image(thumbnail_path, thumbnail_filename, f"/static/{thumbnail_filename}", delete=True)

        # ── Step 4: Captions (instant)
        captions = generate_captions(request.subject, request.palette)

        # ── Step 5: Reel in background thread
        instruction = f"Stare through the screen to see the {subject_cap}"
        cta_text = f"Did you see the {subject_cap}"
        _jobs[job_id] = {"status": "pending", "reel_video": None, "error": None}

        # local_image_paths: files to delete after reel is done (only exist if Supabase is configured)
        local_image_paths = [stereo_path, depth_path, pattern_path] if storage_available() else []

        t = threading.Thread(
            target=_render_reel_bg,
            args=(job_id, stereo_path, depth_path, pattern_path,
                  reel_path, reel_filename, hook_text, instruction, cta_text,
                  local_image_paths),
            daemon=True,
        )
        t.start()

        return GenerateResponse(
            job_id=job_id,
            stereogram_image=stereo_url,
            depth_map_image=depth_url,
            pattern_image=pattern_url,
            thumbnail_image=thumbnail_url,
            reel_video=None,
            reel_status="pending",
            caption=captions,
        )

    except Exception as e:
        print(f"[generate] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.get("/api/generate/status/{job_id}", response_model=StatusResponse)
def get_status(job_id: str):
    """Poll the reel render status for a given job_id."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return StatusResponse(
        job_id=job_id,
        reel_status=job["status"],
        reel_video=job.get("reel_video"),
        error=job.get("error"),
    )


@router.post("/api/generate/reel-only", response_model=StatusResponse)
async def regenerate_reel(
    stereogram_file: UploadFile = File(...),
    depth_map_file: Optional[UploadFile] = File(None),
    pattern_file: Optional[UploadFile] = File(None),
    hook_text: str = Form("Can you see the hidden image"),
    instruction_text: str = Form("Stare through the screen"),
    cta_text: str = Form("Can you see it"),
):
    """Regenerate reel with optional custom depth map and pattern images."""
    os.makedirs(GENERATED_IMAGES_DIR, exist_ok=True)
    os.makedirs(GENERATED_VIDEOS_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    job_id = str(uuid.uuid4())[:8]
    reel_filename = f"reel_{timestamp}.mp4"
    reel_path = os.path.join(GENERATED_VIDEOS_DIR, reel_filename)

    async def _save(upload: UploadFile, name: str) -> str:
        path = os.path.join(GENERATED_IMAGES_DIR, name)
        async with aiofiles.open(path, "wb") as f:
            await f.write(await upload.read())
        return path

    stereo_path = await _save(stereogram_file, f"stereo_{timestamp}.png")
    depth_path  = await _save(depth_map_file, f"depth_{timestamp}.png") if depth_map_file else stereo_path
    pattern_path = await _save(pattern_file, f"pattern_{timestamp}.png") if pattern_file else stereo_path

    _jobs[job_id] = {"status": "pending", "reel_video": None, "error": None}
    t = threading.Thread(
        target=_render_reel_bg,
        args=(job_id, stereo_path, depth_path, pattern_path,
              reel_path, reel_filename, hook_text, instruction_text, cta_text),
        daemon=True,
    )
    t.start()

    return StatusResponse(job_id=job_id, reel_status="pending", reel_video=None, error=None)
