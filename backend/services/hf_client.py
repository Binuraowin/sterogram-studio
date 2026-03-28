import os
import numpy as np
from PIL import Image, ImageOps

HF_TOKEN = os.environ.get("HF_TOKEN")
HF_MODEL = os.environ.get("HF_MODEL", "black-forest-labs/FLUX.1-schnell")

_client = None


def is_available() -> bool:
    return bool(HF_TOKEN)


def _get_client():
    global _client
    if _client is None:
        from huggingface_hub import InferenceClient
        _client = InferenceClient(provider="hf-inference", api_key=HF_TOKEN)
    return _client


def generate_pattern_image(background_pattern: str, width: int, height: int) -> np.ndarray:
    """Generate a background texture image from the pattern name using HF text-to-image."""
    client = _get_client()
    prompt = (
        f"seamless tileable texture, {background_pattern}, "
        "abstract pattern, vibrant colors, no text, no letters, no numbers, flat design, top-down view"
    )
    image = client.text_to_image(prompt, model=HF_MODEL)
    image = image.resize((width, height), Image.LANCZOS).convert("RGB")
    return np.array(image, dtype=np.uint8)


def generate_object_depth_map(hidden_object: str, width: int, height: int) -> np.ndarray:
    """Generate a depth map for the hidden object using HF text-to-image."""
    client = _get_client()
    prompt = (
        f"solid black silhouette shape of a {hidden_object}, pure white background, "
        "centered, single object, no text, no words, no letters, no typography, "
        "no outline, filled solid black shape only, clip art style, vector art, minimal"
    )
    image = client.text_to_image(prompt, model=HF_MODEL)
    image = image.resize((width, height), Image.LANCZOS).convert("L")

    # FLUX rarely produces pure black/white — stretch contrast then threshold
    # so we always get a crisp silhouette regardless of what the model returned
    image = ImageOps.autocontrast(image, cutoff=2)
    image = image.point(lambda p: 0 if p < 140 else 255)

    # Invert: dark silhouette → white (high depth) so object pops forward
    image = ImageOps.invert(image)
    return np.array(image, dtype=np.float32) / 255.0
