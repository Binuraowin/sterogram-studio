"""
Fast SIRDS (Single Image Random Dot Stereogram) generator.
All depth maps and texture generation use vectorized numpy — no Python pixel loops.
"""

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter


# ─────────────────────────────────────────────────────────────
# 1. VECTORIZED DEPTH MAPS
# ─────────────────────────────────────────────────────────────

def _ellipse(yy, xx, cy, cx, ry, rx) -> np.ndarray:
    """Return boolean mask for an ellipse."""
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1.0


def create_dolphin_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)

    # Body
    depth = np.where(_ellipse(yy, xx, cy, cx, height*0.12, width*0.28), 0.85, depth)
    # Tail
    depth = np.where(_ellipse(yy, xx, cy, cx + width*0.30, height*0.08, width*0.08), np.maximum(depth, 0.5), depth)
    # Dorsal fin
    depth = np.where(_ellipse(yy, xx, cy - height*0.16, cx - width*0.05, height*0.10, width*0.07),
                     np.maximum(depth, 0.6), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_heart_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height * 0.48
    scale = min(width, height) * 0.38
    nx = (xx - cx) / scale
    ny = (yy - cy) / scale
    # Heart equation: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
    val = (nx*nx + ny*ny - 1)**3 - nx*nx * ny*ny*ny
    depth = np.where(val <= 0, np.clip(0.3 + np.abs(val) * 2.0, 0, 1), 0.0).astype(np.float32)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.006)
    return depth / (depth.max() + 1e-9)


def create_eagle_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)

    # Body
    depth = np.where(_ellipse(yy, xx, cy, cx, height*0.15, width*0.14), 0.95, depth)
    # Head
    depth = np.where(_ellipse(yy, xx, cy - height*0.19, cx, height*0.09, width*0.07),
                     np.maximum(depth, 0.85), depth)
    # Left wing
    depth = np.where(_ellipse(yy, xx, cy - height*0.04, cx - width*0.26, height*0.07, width*0.22),
                     np.maximum(depth, 0.60), depth)
    # Right wing
    depth = np.where(_ellipse(yy, xx, cy - height*0.04, cx + width*0.26, height*0.07, width*0.22),
                     np.maximum(depth, 0.60), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_star_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    dx = xx - cx
    dy = yy - cy
    angle = np.arctan2(dy, dx)
    r = np.sqrt(dx*dx + dy*dy)
    n_points = 5
    R_outer = min(width, height) * 0.32
    R_inner = R_outer * 0.42
    # Compute star boundary radius per angle
    seg = (angle + np.pi) / (2 * np.pi / n_points)
    frac = seg - np.floor(seg)
    half = np.pi / n_points
    angle_in_seg = frac * (2 * np.pi / n_points)
    t = np.abs(angle_in_seg - half) / half
    r_boundary = R_inner + (R_outer - R_inner) * t
    depth = np.where(r < r_boundary, (1.0 - r / (r_boundary + 1e-9)) ** 0.6, 0.0).astype(np.float32)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_fish_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)
    # Body
    depth = np.where(_ellipse(yy, xx, cy, cx - width*0.04, height*0.11, width*0.24), 0.90, depth)
    # Tail fin — two lobes
    depth = np.where(_ellipse(yy, xx, cy - height*0.09, cx + width*0.26, height*0.08, width*0.07),
                     np.maximum(depth, 0.55), depth)
    depth = np.where(_ellipse(yy, xx, cy + height*0.09, cx + width*0.26, height*0.08, width*0.07),
                     np.maximum(depth, 0.55), depth)
    # Dorsal fin
    depth = np.where(_ellipse(yy, xx, cy - height*0.17, cx - width*0.05, height*0.08, width*0.08),
                     np.maximum(depth, 0.60), depth)
    # Eye
    depth = np.where(_ellipse(yy, xx, cy - height*0.02, cx - width*0.18, height*0.02, width*0.02),
                     np.maximum(depth, 0.95), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_duck_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)
    # Body (large round)
    depth = np.where(_ellipse(yy, xx, cy + height*0.07, cx, height*0.22, width*0.20), 0.85, depth)
    # Head (smaller, sits on top-left)
    depth = np.where(_ellipse(yy, xx, cy - height*0.17, cx - width*0.06, height*0.10, width*0.10),
                     np.maximum(depth, 0.90), depth)
    # Bill (flat ellipse pointing right)
    depth = np.where(_ellipse(yy, xx, cy - height*0.17, cx + width*0.10, height*0.03, width*0.07),
                     np.maximum(depth, 0.70), depth)
    # Tail bump
    depth = np.where(_ellipse(yy, xx, cy, cx + width*0.19, height*0.07, width*0.06),
                     np.maximum(depth, 0.60), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.006)
    return depth / (depth.max() + 1e-9)


def create_butterfly_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)
    # Upper wings
    depth = np.where(_ellipse(yy, xx, cy - height*0.13, cx - width*0.20, height*0.17, width*0.18), 0.85, depth)
    depth = np.where(_ellipse(yy, xx, cy - height*0.13, cx + width*0.20, height*0.17, width*0.18),
                     np.maximum(depth, 0.85), depth)
    # Lower wings (smaller)
    depth = np.where(_ellipse(yy, xx, cy + height*0.13, cx - width*0.15, height*0.12, width*0.14),
                     np.maximum(depth, 0.70), depth)
    depth = np.where(_ellipse(yy, xx, cy + height*0.13, cx + width*0.15, height*0.12, width*0.14),
                     np.maximum(depth, 0.70), depth)
    # Body
    depth = np.where(_ellipse(yy, xx, cy, cx, height*0.18, width*0.03), np.maximum(depth, 0.95), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_cat_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    depth = np.zeros((height, width), dtype=np.float32)
    # Head (round)
    depth = np.where(_ellipse(yy, xx, cy, cx, height*0.22, width*0.20), 0.85, depth)
    # Left ear
    depth = np.where(_ellipse(yy, xx, cy - height*0.26, cx - width*0.14, height*0.08, width*0.07),
                     np.maximum(depth, 0.80), depth)
    # Right ear
    depth = np.where(_ellipse(yy, xx, cy - height*0.26, cx + width*0.14, height*0.08, width*0.07),
                     np.maximum(depth, 0.80), depth)
    # Eyes
    depth = np.where(_ellipse(yy, xx, cy - height*0.04, cx - width*0.09, height*0.03, width*0.04),
                     np.maximum(depth, 0.95), depth)
    depth = np.where(_ellipse(yy, xx, cy - height*0.04, cx + width*0.09, height*0.03, width*0.04),
                     np.maximum(depth, 0.95), depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.006)
    return depth / (depth.max() + 1e-9)


def create_sun_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    dx = xx - cx
    dy = yy - cy
    r = np.sqrt(dx*dx + dy*dy)
    angle = np.arctan2(dy, dx)
    R_core = min(width, height) * 0.20
    R_ray_peak = min(width, height) * 0.38
    R_ray_trough = min(width, height) * 0.28
    n_rays = 8
    ray_mod = 0.5 + 0.5 * np.cos(angle * n_rays)
    r_edge = R_ray_trough + (R_ray_peak - R_ray_trough) * ray_mod
    depth = np.where(r < R_core, 1.0, np.where(r < r_edge, (1.0 - (r - R_core) / (r_edge - R_core + 1e-9)) ** 1.5, 0.0)).astype(np.float32)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.005)
    return depth / (depth.max() + 1e-9)


def create_moon_depth_map(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2, height / 2
    R = min(width, height) * 0.30
    # Full circle
    depth = np.clip(1.0 - np.sqrt(((xx - cx)/R)**2 + ((yy - cy)/R)**2), 0, 1).astype(np.float32)
    # Subtract offset circle to create crescent
    ox = cx + R * 0.28
    R2 = R * 0.82
    cutout = np.sqrt(((xx - ox)/R2)**2 + ((yy - cy)/R2)**2) < 1.0
    depth = np.where(cutout, 0.0, depth)
    depth = gaussian_filter(depth, sigma=max(width, height) * 0.006)
    return depth / (depth.max() + 1e-9)


def generate_depth_map(hidden_object: str, width: int, height: int) -> np.ndarray:
    """Generate depth map for predefined shapes."""
    obj = hidden_object.lower().strip()
    _map = {
        "dolphin":    create_dolphin_depth_map,
        "heart":      create_heart_depth_map,
        "eagle":      create_eagle_depth_map,
        "star":       create_star_depth_map,
        "fish":       create_fish_depth_map,
        "tiny fish":  create_fish_depth_map,
        "duck":       create_duck_depth_map,
        "rubber duck": create_duck_depth_map,
        "butterfly":  create_butterfly_depth_map,
        "cat":        create_cat_depth_map,
        "sun":        create_sun_depth_map,
        "moon":       create_moon_depth_map,
    }
    fn = _map.get(obj, create_heart_depth_map)
    return fn(width, height)


# ─────────────────────────────────────────────────────────────
# 2. VECTORIZED COLORFUL TEXTURE
# ─────────────────────────────────────────────────────────────

PALETTES = {
    "rainbow": [(255,50,50),(255,150,0),(255,255,0),(0,200,100),(0,150,255),(150,0,255)],
    "ocean":   [(0,50,180),(0,150,220),(0,220,200),(100,255,220),(50,100,200),(0,80,160)],
    "forest":  [(20,120,20),(80,180,40),(160,220,60),(40,160,80),(100,200,100),(20,80,20)],
    "sunset":  [(220,50,50),(255,120,0),(255,200,50),(200,50,100),(255,80,80),(180,20,80)],
    "cosmic":  [(80,0,160),(160,0,200),(200,50,255),(255,100,200),(100,200,255),(0,100,200)],
}


def generate_colorful_texture(tile_w: int, tile_h: int, palette: str = "rainbow") -> np.ndarray:
    """Fast vectorized colorful texture tile — no Python pixel loops."""
    rng = np.random.default_rng()
    colors = PALETTES.get(palette, PALETTES["rainbow"])

    # Start with random noise
    noise_r = rng.uniform(0, 0.3, (tile_h, tile_w)).astype(np.float32)
    noise_g = rng.uniform(0, 0.3, (tile_h, tile_w)).astype(np.float32)
    noise_b = rng.uniform(0, 0.3, (tile_h, tile_w)).astype(np.float32)

    # Blend colored Gaussian blobs using vectorized ops
    n_blobs = 60
    blob_r = rng.integers(6, 30, n_blobs)
    blob_x = rng.integers(0, tile_w, n_blobs)
    blob_y = rng.integers(0, tile_h, n_blobs)
    blob_colors = [colors[i % len(colors)] for i in rng.integers(0, len(colors), n_blobs)]
    blob_intensity = rng.uniform(0.5, 1.0, n_blobs).astype(np.float32)

    yy, xx = np.mgrid[0:tile_h, 0:tile_w].astype(np.float32)

    for i in range(n_blobs):
        bx, by, br = int(blob_x[i]), int(blob_y[i]), int(blob_r[i])
        col = blob_colors[i]
        intens = blob_intensity[i]
        # Vectorized distance, with wrapping
        dx = np.minimum(np.abs(xx - bx), tile_w - np.abs(xx - bx))
        dy = np.minimum(np.abs(yy - by), tile_h - np.abs(yy - by))
        dist = np.sqrt(dx*dx + dy*dy)
        fade = np.clip(np.maximum(1 - dist / br, 0) ** 1.5 * intens, 0, 1)
        noise_r += fade * col[0] / 255.0
        noise_g += fade * col[1] / 255.0
        noise_b += fade * col[2] / 255.0

    # Normalize channels
    def norm(ch):
        mn, mx = ch.min(), ch.max()
        return np.clip((ch - mn) / (mx - mn + 1e-9), 0, 1)

    r = norm(noise_r)
    g = norm(noise_g)
    b = norm(noise_b)

    tile = np.stack([r, g, b], axis=2)
    tile = np.nan_to_num(tile, nan=0.0, posinf=1.0, neginf=0.0)
    tile = (np.clip(tile, 0, 1) * 255).astype(np.uint8)

    # Light Gaussian blur for smoothness
    from PIL import ImageFilter
    pil_tile = Image.fromarray(tile, "RGB").filter(ImageFilter.GaussianBlur(radius=1))
    return np.array(pil_tile, dtype=np.uint8)


# ─────────────────────────────────────────────────────────────
# 3. FAST VECTORIZED SIRDS CORE
# ─────────────────────────────────────────────────────────────

def generate_sirds_image(
    hidden_object: str = "dolphin",
    palette: str = "rainbow",
    width: int = 1080,
    height: int = 1080,
    max_shift: int = 40,
) -> Image.Image:
    """Generate a SIRDS autostereogram (stereogram only)."""
    img, _, _ = generate_sirds_full(hidden_object, palette, width, height, max_shift)
    return img


def generate_sirds_full(
    hidden_object: str = "dolphin",
    palette: str = "rainbow",
    width: int = 1080,
    height: int = 1080,
    max_shift: int = 40,
) -> tuple:
    """
    Generate a SIRDS autostereogram plus depth map and pattern images.

    Returns:
        (stereogram: Image.Image, depth_map_img: Image.Image, pattern_img: Image.Image)
    """
    depth_map = generate_depth_map(hidden_object, width, height)  # (H, W) float32 0..1

    tile_w = max(width // 7, 32)
    tile_h = height
    texture = generate_colorful_texture(tile_w, tile_h, palette)  # (tile_h, tile_w, 3)

    xx = np.arange(width, dtype=np.int32)[np.newaxis, :]
    yy = np.arange(height, dtype=np.int32)[:, np.newaxis]

    shift = (depth_map * max_shift).astype(np.int32)
    x_tex = (xx - shift) % tile_w
    y_tex = yy % tile_h

    result = texture[y_tex, x_tex]
    stereogram_img = Image.fromarray(result, "RGB")

    # Depth map as grayscale visualisation
    depth_vis = (depth_map * 255).astype(np.uint8)
    depth_img = Image.fromarray(depth_vis, "L").convert("RGB")

    # Pattern tile tiled to full width
    reps = (width + tile_w - 1) // tile_w
    tiled = np.tile(texture, (1, reps, 1))[:, :width, :]
    pattern_img = Image.fromarray(tiled.astype(np.uint8), "RGB")

    return stereogram_img, depth_img, pattern_img


# ─────────────────────────────────────────────────────────────
# 4. COMPATIBILITY ALIAS (used by legacy stereograms router)
# ─────────────────────────────────────────────────────────────

def generate_stereogram(params: dict) -> tuple:
    """
    Compatibility wrapper for the legacy stereograms router.
    Accepts params dict with keys: hidden_object, palette, width, height.
    Returns (image: Image.Image, depth_map_img: None).
    """
    hidden_object = params.get("hidden_object", "dolphin")
    palette = params.get("palette", "rainbow")
    width = int(params.get("width", 1080))
    height = int(params.get("height", 1080))
    img = generate_sirds_image(hidden_object, palette, width, height)
    return img, None
