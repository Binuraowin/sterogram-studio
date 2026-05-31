import os
import httpx

KIE_API_KEY = os.environ.get("KIE_API_KEY")
_BASE = "https://api.kie.ai"


def is_available() -> bool:
    return bool(KIE_API_KEY)


def _headers() -> dict:
    return {"Authorization": f"Bearer {KIE_API_KEY}", "Content-Type": "application/json"}


def generate_video(image_url_1: str, image_url_2: str, prompt: str) -> str:
    """
    Submit a Veo3 Fast image-to-video task using first + last frames.
    image_url_1 and image_url_2 must be publicly accessible URLs.
    Returns the taskId string.
    """
    resp = httpx.post(
        f"{_BASE}/api/v1/veo/generate",
        headers=_headers(),
        json={
            "prompt": prompt,
            "imageUrls": [image_url_1, image_url_2],
            "model": "veo3_fast",
            "aspect_ratio": "9:16",
            "generationType": "FIRST_AND_LAST_FRAMES_2_VIDEO",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 200:
        raise RuntimeError(f"KIE API error: {data.get('msg')}")
    return data["data"]["taskId"]


def get_video_status(task_id: str) -> dict:
    """
    Poll a Veo3 task.
    Returns: {state: "generating"|"success"|"failed", video_url: str|None, error: str|None}
    successFlag values: 0=generating, 1=success, 2=failed, 3=generation failed
    """
    resp = httpx.get(
        f"{_BASE}/api/v1/veo/record-info",
        headers={"Authorization": f"Bearer {KIE_API_KEY}"},
        params={"taskId": task_id},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json().get("data", {})
    flag = data.get("successFlag", 0)

    if flag == 1:
        result = data.get("response") or {}
        urls = result.get("resultUrls") or []
        return {"state": "success", "video_url": urls[0] if urls else None, "error": None}

    if flag in (2, 3):
        return {
            "state": "failed",
            "video_url": None,
            "error": data.get("errorMessage") or "Generation failed",
        }

    return {"state": "generating", "video_url": None, "error": None}
