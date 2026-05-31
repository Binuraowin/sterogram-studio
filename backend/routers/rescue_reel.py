import os
import json
import uuid
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()

GENERATED_IMAGES_DIR = Path(__file__).parent.parent / "generated_images"
GENERATED_VIDEOS_DIR = Path(__file__).parent.parent / "generated_videos"


# ── Schemas ────────────────────────────────────────────────────────────────────

class GeneratePromptsRequest(BaseModel):
    scene: str
    style: str = "natural"  # "natural" | "cctv"


class GenerateImagesRequest(BaseModel):
    image_prompts: List[str]


class RegeneratePromptRequest(BaseModel):
    scene: str
    style: str = "natural"  # "natural" | "cctv"
    prompt_type: str   # "image_0"|"image_1"|"image_2"|"video_0"|"video_1"|"caption"
    current_prompts: dict  # full current prompts for context


class RegenerateImageRequest(BaseModel):
    prompt: str
    index: int          # 0, 1, or 2
    reference_url: str | None = None  # Frame 0 URL used as img2img reference for frames 1 and 2


class GenerateVideosRequest(BaseModel):
    image_urls: List[str]      # exactly 3
    video_prompts: List[str]   # exactly 2


class MergeVideosRequest(BaseModel):
    video_url_1: str
    video_url_2: str


class GenerateSingleVideoRequest(BaseModel):
    image_url_start: str
    image_url_end: str
    video_prompt: str


class SaveSessionRequest(BaseModel):
    id: Optional[int] = None
    scene: str
    style: str = "natural"
    status: str = "draft"
    image_prompts: Optional[List[str]] = None
    video_prompts: Optional[List[str]] = None
    caption: Optional[str] = None
    image_urls: Optional[List[str]] = None
    video_url_1: Optional[str] = None
    video_url_2: Optional[str] = None
    final_video_url: Optional[str] = None


def _reel_to_dict(reel) -> dict:
    return {
        "id": reel.id,
        "scene": reel.scene,
        "style": reel.style,
        "status": reel.status,
        "image_prompts": json.loads(reel.image_prompts) if reel.image_prompts else None,
        "video_prompts": json.loads(reel.video_prompts) if reel.video_prompts else None,
        "caption": reel.caption,
        "image_urls": json.loads(reel.image_urls) if reel.image_urls else None,
        "video_url_1": reel.video_url_1,
        "video_url_2": reel.video_url_2,
        "final_video_url": reel.final_video_url,
        "created_at": reel.created_at.isoformat() if reel.created_at else None,
        "updated_at": reel.updated_at.isoformat() if reel.updated_at else None,
    }


# ── Session CRUD ───────────────────────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    from models import RescueReel
    reels = db.query(RescueReel).order_by(RescueReel.updated_at.desc()).limit(50).all()
    return [_reel_to_dict(r) for r in reels]


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    from models import RescueReel
    reel = db.query(RescueReel).filter(RescueReel.id == session_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Session not found")
    return _reel_to_dict(reel)


@router.post("/sessions")
def save_session(body: SaveSessionRequest, db: Session = Depends(get_db)):
    from models import RescueReel
    from datetime import datetime

    if body.id:
        reel = db.query(RescueReel).filter(RescueReel.id == body.id).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        reel = RescueReel()
        db.add(reel)

    reel.scene = body.scene
    reel.style = body.style
    reel.status = body.status
    reel.image_prompts = json.dumps(body.image_prompts) if body.image_prompts else None
    reel.video_prompts = json.dumps(body.video_prompts) if body.video_prompts else None
    reel.caption = body.caption
    reel.image_urls = json.dumps(body.image_urls) if body.image_urls else None
    reel.video_url_1 = body.video_url_1
    reel.video_url_2 = body.video_url_2
    reel.final_video_url = body.final_video_url
    reel.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(reel)
    return _reel_to_dict(reel)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    from models import RescueReel
    reel = db.query(RescueReel).filter(RescueReel.id == session_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(reel)
    db.commit()
    return {"ok": True}


# ── Step 1: Generate prompts via HF text model ─────────────────────────────────

@router.post("/generate-prompts")
def generate_prompts(body: GeneratePromptsRequest):
    if not body.scene.strip():
        raise HTTPException(status_code=400, detail="Scene description is required")

    try:
        from services.rescue_prompt_generator import generate_rescue_prompts
        result = generate_rescue_prompts(body.scene, body.style)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {e}")


# ── Regenerate a single prompt ────────────────────────────────────────────────

@router.post("/regenerate-prompt")
def regenerate_prompt(body: RegeneratePromptRequest):
    import anthropic

    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    is_cctv = body.style == "cctv"

    if is_cctv:
        img0_suffix = "Start with 'CCTV security camera still frame', overhead angle, grainy surveillance texture, timestamp visible, muted desaturated colors. Include exact subject details. End with 'looks exactly like real CCTV footage — not illustrated, not cinematic'."
    else:
        img0_suffix = "Documentary/photojournalism style, ground-level natural perspective, realistic lighting. Include exact subject details. End with 'photorealistic, natural lighting, not illustrated, not CGI'."

    type_instructions = {
        "image_0": f"Generate ONLY the Opening Frame image prompt. {img0_suffix}",
        "image_1": (
            "Generate ONLY the Middle Frame image prompt. "
            + ("Same CCTV security camera still frame style as opening. " if is_cctv else "Same documentary style as opening frame. ")
            + "SAME EXACT subject description as the opening frame. Show human rescuer now present interacting with the animal."
        ),
        "image_2": (
            "Generate ONLY the Ending Frame image prompt. "
            + ("Same CCTV security camera still frame style. " if is_cctv else "Same documentary style. ")
            + "SAME EXACT subject description. Animal now safe, warm, and at peace with rescuer."
        ),
        "video_0": (
            "Generate ONLY the Video 1 prompt (Frame 1 → Frame 2). "
            + ("Realistic CCTV footage: static mounted camera, no movement, person physically enters frame and approaches the animal step by step." if is_cctv else "Natural handheld or ground-level footage: person walks toward animal, crouches, reaches out — realistic human movement, natural lighting.")
        ),
        "video_1": (
            "Generate ONLY the Video 2 prompt (Frame 2 → Frame 3). "
            + ("Realistic CCTV footage: same static camera angle, person gently picks up or shelters the animal, both exit frame together." if is_cctv else "Natural footage: person holds animal, animal relaxes, they move toward safety — warm and heartwarming.")
        ),
        "caption": "Generate ONLY the Facebook Reel caption. Emotional hook opening sentence, brief story, call-to-action, 5-8 relevant hashtags.",
    }

    instruction = type_instructions.get(body.prompt_type)
    if not instruction:
        raise HTTPException(status_code=400, detail=f"Unknown prompt_type: {body.prompt_type}")

    system_msg = (
        "You are a prompt writer for animal rescue Facebook Reels. "
        + ("Write in CCTV/surveillance camera style — gritty, overhead, grainy, static camera, no cinematic language. " if is_cctv else "Write in natural documentary/photojournalism style — realistic, ground-level, candid. ")
        + "Reply with ONLY the prompt text — no JSON, no labels, no explanation."
    )

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=system_msg,
        messages=[{
            "role": "user",
            "content": (
                f"Scene: \"{body.scene}\"\n\n"
                f"Current prompts for context:\n{body.current_prompts}\n\n"
                f"Task: {instruction}\n\n"
                f"Reply with ONLY the new prompt text, nothing else."
            ),
        }],
    )

    return {"value": message.content[0].text.strip()}


# ── Regenerate a single image ──────────────────────────────────────────────────

@router.post("/regenerate-image")
def regenerate_image(body: RegenerateImageRequest):
    from services import hf_client
    if not hf_client.is_available():
        raise HTTPException(status_code=503, detail="HF_TOKEN not configured")

    GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Load reference image from URL if provided (used for frames 1 and 2)
        reference_image = None
        if body.reference_url:
            try:
                import io
                from PIL import Image as PILImage
                with httpx.Client(timeout=30) as http:
                    r = http.get(body.reference_url, follow_redirects=True)
                    r.raise_for_status()
                reference_image = PILImage.open(io.BytesIO(r.content)).convert("RGB")
            except Exception:
                reference_image = None  # fail gracefully, fall back to text-to-image

        image = hf_client.generate_rescue_image(body.prompt, reference_image=reference_image)

        uid = uuid.uuid4().hex[:8]
        filename = f"rescue_frame_{body.index + 1}_{uid}.png"
        filepath = GENERATED_IMAGES_DIR / filename
        image.save(str(filepath), "PNG")

        from services.storage import is_available as storage_ok, upload_image
        if storage_ok():
            try:
                public_url = upload_image(str(filepath), f"rescue/{filename}")
                os.remove(str(filepath))
                return {"image_url": public_url}
            except Exception:
                pass

        api_base = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
        return {"image_url": f"{api_base}/static/{filename}?v={int(time.time())}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image regeneration failed: {e}")


# ── Step 2: Generate 3 images via FLUX ────────────────────────────────────────

@router.post("/generate-images")
def generate_images(body: GenerateImagesRequest):
    if len(body.image_prompts) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 image prompts required")

    from services import hf_client
    if not hf_client.is_available():
        raise HTTPException(status_code=503, detail="HF_TOKEN not configured")

    GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    client = hf_client._get_client()
    image_urls = []

    rescue_model = os.environ.get(
        "RESCUE_IMAGE_MODEL",
        os.environ.get("HF_MODEL", "black-forest-labs/FLUX.1-schnell"),
    )

    negative_prompt = (
        "cartoon, anime, illustration, painting, drawing, CGI, 3D render, "
        "digital art, concept art, artistic, stylized, smooth skin, perfect lighting, "
        "studio photography, shallow depth of field, bokeh, vibrant saturated colors, "
        "cinematic, movie still, professional photography, DSLR, sharp focus, "
        "cute, adorable rendering, soft, dreamy, fantasy"
    )

    def _generate_image(prompt: str):
        """Try with negative_prompt; fall back without if model doesn't support it."""
        try:
            return client.text_to_image(prompt, model=rescue_model, negative_prompt=negative_prompt)
        except Exception:
            return client.text_to_image(prompt, model=rescue_model)

    for i, prompt in enumerate(body.image_prompts):
        try:
            image = _generate_image(prompt)

            # Save locally
            uid = uuid.uuid4().hex[:8]
            filename = f"rescue_frame_{i+1}_{uid}.png"
            filepath = GENERATED_IMAGES_DIR / filename
            image.save(str(filepath), "PNG")

            # Upload to Supabase if available, else serve locally
            from services.storage import is_available as storage_ok, upload_image
            if storage_ok():
                try:
                    public_url = upload_image(str(filepath), f"rescue/{filename}")
                    os.remove(str(filepath))
                    image_urls.append(public_url)
                except Exception as upload_err:
                    print(f"[Supabase] Upload failed, falling back: {upload_err}")
                    api_base = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
                    image_urls.append(f"{api_base}/static/{filename}?v={int(time.time())}")
            else:
                api_base = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
                image_urls.append(f"{api_base}/static/{filename}?v={int(time.time())}")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image {i+1} generation failed: {e}")

    return {"image_urls": image_urls}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_local_url(url: str) -> bool:
    return "localhost" in url or "127.0.0.1" in url


def _ensure_public_url(image_url: str) -> str:
    """
    If image_url is a localhost URL (not reachable by external APIs like KIE),
    extract the file from disk and upload it to Supabase to get a public URL.
    """
    if not _is_local_url(image_url):
        return image_url

    from services.storage import is_available as supabase_ok, upload_image
    if not supabase_ok():
        raise RuntimeError(
            "Image is stored locally but Supabase is not configured. "
            "Set SUPABASE_URL and SUPABASE_KEY so rescue reel images can be hosted publicly."
        )

    # Extract filename from URL (strip query params)
    filename = image_url.split("?")[0].split("/")[-1]
    filepath = GENERATED_IMAGES_DIR / filename

    if not filepath.exists():
        raise RuntimeError(f"Local image file not found: {filepath}")

    try:
        public_url = upload_image(str(filepath), f"rescue/{filename}")
        return public_url
    except Exception as exc:
        raise RuntimeError(
            f"Images are stored locally but Supabase upload failed — "
            f"check that SUPABASE_URL is a valid reachable URL and SUPABASE_KEY is correct. "
            f"Error: {exc}"
        ) from exc


# ── Retry a single failed video ───────────────────────────────────────────────

@router.post("/generate-video-single")
def generate_video_single(body: GenerateSingleVideoRequest):
    from services import kie_client
    if not kie_client.is_available():
        raise HTTPException(status_code=503, detail="KIE_API_KEY not configured")

    try:
        url_start = _ensure_public_url(body.image_url_start)
        url_end = _ensure_public_url(body.image_url_end)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        task_id = kie_client.generate_video(url_start, url_end, body.video_prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video submission failed: {e}")

    return {"task_id": task_id}


# ── Step 3: Submit video generation tasks ─────────────────────────────────────

@router.post("/generate-videos")
def generate_videos(body: GenerateVideosRequest):
    if len(body.image_urls) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 image URLs required")
    if len(body.video_prompts) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 video prompts required")

    from services import kie_client
    if not kie_client.is_available():
        raise HTTPException(status_code=503, detail="KIE_API_KEY not configured")

    # Resolve any localhost URLs to publicly accessible Supabase URLs
    try:
        public_urls = [_ensure_public_url(u) for u in body.image_urls]
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Submit both video tasks in parallel
    results = {}
    errors = {}

    def submit(label: str, url_a: str, url_b: str, prompt: str):
        try:
            return label, kie_client.generate_video(url_a, url_b, prompt), None
        except Exception as e:
            return label, None, str(e)

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(submit, "1", public_urls[0], public_urls[1], body.video_prompts[0]),
            pool.submit(submit, "2", public_urls[1], public_urls[2], body.video_prompts[1]),
        ]
        for f in as_completed(futures):
            label, task_id, err = f.result()
            if err:
                errors[label] = err
            else:
                results[label] = task_id

    if errors:
        detail = "; ".join(f"Video {k}: {v}" for k, v in errors.items())
        raise HTTPException(status_code=500, detail=detail)

    return {"task_id_1": results["1"], "task_id_2": results["2"]}


# ── Step 4: Poll video status ─────────────────────────────────────────────────

@router.get("/video-status/{task_id}")
def video_status(task_id: str):
    from services import kie_client
    if not kie_client.is_available():
        raise HTTPException(status_code=503, detail="KIE_API_KEY not configured")

    try:
        return kie_client.get_video_status(task_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {e}")


# ── Step 5: Merge two videos with FFmpeg ──────────────────────────────────────

@router.post("/merge-videos")
def merge_videos(body: MergeVideosRequest):
    GENERATED_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        v1_path = os.path.join(tmpdir, "v1.mp4")
        v2_path = os.path.join(tmpdir, "v2.mp4")

        # Download both videos
        for url, dest in [(body.video_url_1, v1_path), (body.video_url_2, v2_path)]:
            try:
                with httpx.stream("GET", url, timeout=120, follow_redirects=True) as r:
                    r.raise_for_status()
                    with open(dest, "wb") as f:
                        for chunk in r.iter_bytes(chunk_size=8192):
                            f.write(chunk)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to download video: {e}")

        # Write concat list
        concat_file = os.path.join(tmpdir, "concat.txt")
        with open(concat_file, "w") as f:
            f.write(f"file '{v1_path}'\n")
            f.write(f"file '{v2_path}'\n")

        # Output filename
        uid = uuid.uuid4().hex[:8]
        out_filename = f"rescue_reel_{uid}.mp4"
        out_path = GENERATED_VIDEOS_DIR / out_filename

        # FFmpeg concat (stream copy — no re-encode, instant)
        try:
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", concat_file,
                    "-c", "copy",
                    str(out_path),
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr[-500:])
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="FFmpeg not found on server")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="FFmpeg merge timed out")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"FFmpeg merge failed: {e}")

    api_base = os.environ.get("NEXT_PUBLIC_API_URL", "http://localhost:8000")
    return {
        "video_url": f"{api_base}/videos/{out_filename}",
        "filename": out_filename,
    }
