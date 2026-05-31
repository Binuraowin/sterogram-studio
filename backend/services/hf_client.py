import os
import tempfile
import numpy as np
from PIL import Image, ImageOps, ImageFilter

HF_TOKEN = os.environ.get("HF_TOKEN")
HF_MODEL = os.environ.get("HF_MODEL", "black-forest-labs/FLUX.1-schnell")

_hf_client   = None
_illusion_gc = None   # Gradio client for IllusionDiffusion space


def is_available() -> bool:
    return bool(HF_TOKEN)


def _get_client():
    global _hf_client
    if _hf_client is None:
        from huggingface_hub import InferenceClient
        _hf_client = InferenceClient(provider="hf-inference", api_key=HF_TOKEN)
    return _hf_client


def _get_illusion_client():
    """Lazy-init Gradio client for AP123/IllusionDiffusion HF Space."""
    global _illusion_gc
    if _illusion_gc is None:
        from gradio_client import Client as GradioClient
        _illusion_gc = GradioClient("AP123/IllusionDiffusion")
    return _illusion_gc


# ── Standard HF helpers ───────────────────────────────────────────────────────

def generate_rescue_image(prompt: str, reference_image=None, strength: float = 0.72) -> Image.Image:
    client = _get_client()
    model = os.environ.get("RESCUE_IMAGE_MODEL", os.environ.get("HF_MODEL", "black-forest-labs/FLUX.1-schnell"))
    negative_prompt = (
        "cartoon, anime, illustration, painting, CGI, 3D render, digital art, "
        "stylized, smooth skin, perfect lighting, studio photography, bokeh, "
        "vibrant saturated colors, cinematic, movie still, cute rendering, dreamy, fantasy"
    )
    if reference_image is not None:
        try:
            return client.image_to_image(
                reference_image, prompt=prompt, model=model,
                strength=strength, negative_prompt=negative_prompt,
            )
        except Exception:
            pass
    try:
        return client.text_to_image(prompt, model=model, negative_prompt=negative_prompt)
    except Exception:
        return client.text_to_image(prompt, model=model)


def generate_pattern_image(background_pattern: str, width: int, height: int) -> np.ndarray:
    client = _get_client()
    prompt = (
        f"seamless tileable texture, {background_pattern}, "
        "abstract pattern, vibrant colors, no text, no letters, no numbers, flat design, top-down view"
    )
    image = client.text_to_image(prompt, model=HF_MODEL)
    image = image.resize((width, height), Image.LANCZOS).convert("RGB")
    return np.array(image, dtype=np.uint8)


# ── Optical illusion ──────────────────────────────────────────────────────────

def _make_control_image(silhouette_arr: np.ndarray, width: int, height: int) -> Image.Image:
    """
    Clean white-on-black control image for IllusionDiffusion.
    Pure white where the hidden shape is, pure black everywhere else.
    This is the correct input format the ControlNet expects.
    """
    control = (silhouette_arr * 255).astype(np.uint8)
    return Image.fromarray(control).convert("RGB")


def generate_optical_illusion(
    hidden_object: str,
    background_pattern: str,
    width: int,
    height: int,
    silhouette_arr: np.ndarray | None = None,
    depth_intensity: float = 0.35,
) -> tuple[Image.Image, Image.Image]:
    """
    Generate a color optical illusion via the AP123/IllusionDiffusion HF Space.

    Returns (illusion_image, control_image).
      - illusion_image : the final color scene with hidden shape baked in
      - control_image  : the B&W spiral input fed to ControlNet (shown as depth map)

    depth_intensity (0.1–0.6) maps to controlnet_conditioning_scale (0.5–1.8):
      lower  → hidden shape subtle
      higher → hidden shape more visible
    """
    if silhouette_arr is None:
        silhouette_arr = generate_object_depth_map(hidden_object, width, height)

    control_img = _make_control_image(silhouette_arr, width, height)

    # Map depth_intensity 0.1–0.6 → conditioning scale 0.5–1.8
    conditioning_scale = round(0.5 + depth_intensity * 2.17, 2)

    scene_prompt = (
        f"photorealistic {background_pattern}, masterpiece, sharp focus, "
        "beautiful natural lighting, vivid colors, 8k, high detail"
    )
    negative = (
        "ugly, blurry, low quality, watermark, text, logo, cartoon, anime, "
        "grayscale, black and white, distorted, deformed"
    )

    # ── Primary: IllusionDiffusion HF Space ───────────────────────────────────
    try:
        from gradio_client import handle_file

        gc = _get_illusion_client()

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            control_img.save(tmp.name)
            tmp_path = tmp.name

        try:
            result = gc.predict(
                handle_file(tmp_path),  # control_image
                scene_prompt,           # prompt
                negative,               # negative_prompt
                7.5,                    # guidance_scale
                conditioning_scale,     # controlnet_conditioning_scale (driven by depth_intensity)
                0.0,                    # control_guidance_start
                1.0,                    # control_guidance_end
                1.0,                    # upscaler_strength
                -1,                     # seed (-1 = random)
                "DPM++ Karras SDE",     # sampler
                api_name="/inference",
            )
        finally:
            os.unlink(tmp_path)

        # Returns (output_filepath, output_filepath, seed_used)
        out_path = result[0] if isinstance(result, (list, tuple)) else result
        if isinstance(out_path, dict) and "path" in out_path:
            out_path = out_path["path"]
        out = Image.open(out_path).convert("RGB")

        print(f"[Illusion] Space succeeded (conditioning={conditioning_scale})")
        return out.resize((width, height), Image.LANCZOS), control_img.resize((width, height), Image.LANCZOS)

    except Exception as e:
        print(f"[Illusion] Space call failed ({e}), using tonal fallback")

    # ── Fallback: FLUX scene + tonal embedding ────────────────────────────────
    hf = _get_client()
    try:
        scene = hf.text_to_image(scene_prompt, model=HF_MODEL, negative_prompt=negative)
    except Exception:
        scene = hf.text_to_image(scene_prompt, model=HF_MODEL)

    scene = scene.resize((width, height), Image.LANCZOS).convert("RGB")
    scene_f = np.array(scene, dtype=np.float32)

    mask_pil = Image.fromarray((silhouette_arr * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(radius=30)
    )
    mask = np.array(mask_pil, dtype=np.float32)[:, :, np.newaxis] / 255.0

    # Scale tonal contrast with depth_intensity
    bright_scale = 1.0 + depth_intensity * 0.6   # 0.1→1.06  0.6→1.36
    dim_scale    = 1.0 - depth_intensity * 0.3    # 0.1→0.97  0.6→0.82
    warm_bright  = np.array([bright_scale * 1.05, bright_scale, bright_scale * 0.92], np.float32)
    cool_dim     = np.array([dim_scale * 0.96,    dim_scale,    dim_scale  * 1.02  ], np.float32)
    factor       = warm_bright * mask + cool_dim * (1.0 - mask)

    result_arr = np.clip(scene_f * factor, 0.0, 255.0).astype(np.uint8)
    print("[Illusion] Tonal fallback done")
    return Image.fromarray(result_arr, "RGB"), control_img.resize((width, height), Image.LANCZOS)


# ── Depth / silhouette ────────────────────────────────────────────────────────

def generate_object_depth_map(hidden_object: str, width: int, height: int) -> np.ndarray:
    """Generate a silhouette depth map for the hidden object via HF text-to-image."""
    client = _get_client()
    prompt = (
        f"solid black silhouette shape of a {hidden_object}, pure white background, "
        "centered, single object, no text, no words, no letters, no typography, "
        "no outline, filled solid black shape only, clip art style, vector art, minimal"
    )
    image = client.text_to_image(prompt, model=HF_MODEL)
    image = image.resize((width, height), Image.LANCZOS).convert("L")
    image = ImageOps.autocontrast(image, cutoff=2)
    image = image.point(lambda p: 0 if p < 140 else 255)
    image = ImageOps.invert(image)  # dark silhouette → white (1.0 = foreground)
    return np.array(image, dtype=np.float32) / 255.0
