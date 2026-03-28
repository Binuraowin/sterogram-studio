import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


COLOR_MODE_MAP = {
    "Jester Hat Pattern": "festive",
    "Confetti Explosion": "festive",
    "Checkerboard Warp": "cool",
    "Swirling Hypnosis": "warm",
    "Broken Mirror Shards": "cool",
    "Rubber Chicken Texture": "warm",
    "Whoopee Cushion Pattern": "festive",
    "Googly Eyes": "random",
    "Fake Spiderweb": "cool",
    "Water Droplet Splash": "cool",
}


def get_color_mode(background_pattern: str, requested_mode: str = "random") -> str:
    if requested_mode != "random":
        return requested_mode
    return COLOR_MODE_MAP.get(background_pattern, "random")


def generate_depth_map(hidden_object: str, width: int, height: int) -> np.ndarray:
    # Try HF-generated silhouette first
    try:
        from services.hf_client import is_available, generate_object_depth_map
        if is_available():
            print(f"[HF] Generating depth map for: {hidden_object}")
            return generate_object_depth_map(hidden_object, width, height)
    except Exception as e:
        print(f"[HF] Depth map failed, falling back to text render: {e}")

    # Fallback: draw the hidden object name as text
    img = Image.new("L", (width, height), color=0)
    draw = ImageDraw.Draw(img)

    font_size = max(height // 6, 20)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except Exception:
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), hidden_object, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    draw.text((x, y), hidden_object, fill=255, font=font)

    img = img.filter(ImageFilter.GaussianBlur(radius=8))
    return np.array(img, dtype=np.float32) / 255.0


def generate_noise_strip(
    width: int, height: int, dot_density: int, color_mode: str, background_pattern: str = ""
) -> np.ndarray:
    # Try HF-generated pattern texture first
    try:
        from services.hf_client import is_available, generate_pattern_image
        if is_available() and background_pattern:
            print(f"[HF] Generating pattern texture for: {background_pattern}")
            return generate_pattern_image(background_pattern, width, height)
    except Exception as e:
        print(f"[HF] Pattern generation failed, falling back to noise: {e}")

    # Fallback: random colored dot noise
    block_w = max(1, width // dot_density)
    block_h = max(1, height // dot_density)

    small = np.random.randint(0, 256, (block_h, block_w, 3), dtype=np.uint8)

    if color_mode == "warm":
        small[:, :, 0] = np.random.randint(180, 256, (block_h, block_w), dtype=np.uint8)
        small[:, :, 1] = np.random.randint(100, 180, (block_h, block_w), dtype=np.uint8)
        small[:, :, 2] = np.random.randint(0, 100, (block_h, block_w), dtype=np.uint8)
    elif color_mode == "cool":
        small[:, :, 0] = np.random.randint(0, 100, (block_h, block_w), dtype=np.uint8)
        small[:, :, 1] = np.random.randint(100, 180, (block_h, block_w), dtype=np.uint8)
        small[:, :, 2] = np.random.randint(180, 256, (block_h, block_w), dtype=np.uint8)
    elif color_mode == "festive":
        colors = [
            [220, 30, 30],
            [30, 180, 30],
            [220, 200, 30],
            [30, 30, 220],
        ]
        for row_idx in range(block_h):
            color = colors[row_idx % len(colors)]
            noise = np.random.randint(-40, 40, (block_w, 3))
            row_color = np.clip(
                np.array(color, dtype=np.int32) + noise,
                0, 255
            ).astype(np.uint8)
            small[row_idx] = row_color

    small_img = Image.fromarray(small, mode="RGB")
    strip_img = small_img.resize((width, height), Image.NEAREST)
    return np.array(strip_img, dtype=np.uint8)


def generate_stereogram(params: dict) -> Image.Image:
    hidden_object = params.get("hidden_object", "HELLO")
    background_pattern = params.get("background_pattern", "")
    width = params.get("width", 1200)
    height = params.get("height", 800)
    depth_intensity = params.get("depth_intensity", 0.35)
    dot_density = params.get("dot_density", 5)
    color_mode = params.get("color_mode", "random")

    color_mode = get_color_mode(background_pattern, color_mode)

    depth_map = generate_depth_map(hidden_object, width, height)

    strip_width = width // 10

    noise_strip = generate_noise_strip(strip_width, height, dot_density, color_mode, background_pattern)

    result = np.zeros((height, width, 3), dtype=np.uint8)
    result[:, 0:strip_width, :] = noise_strip

    depth_scale = depth_map.shape[1] / width

    for x in range(strip_width, width):
        for y in range(height):
            depth_x = int(x * depth_scale)
            depth_x = min(depth_x, depth_map.shape[1] - 1)
            depth_val = depth_map[y, depth_x]
            shift = int(depth_val * strip_width * depth_intensity)
            src_x = x - strip_width + shift
            src_x = max(0, min(src_x, x - 1))
            result[y, x] = result[y, src_x]

    img = Image.fromarray(result, mode="RGB")
    return img
