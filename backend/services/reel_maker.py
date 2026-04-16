"""
Fast Facebook Reel maker using FFmpeg filter_complex.
Creates 1080x1920 vertical MP4s from stereogram PNGs.
No frame-by-frame generation — uses PNG overlays fed directly to FFmpeg.
"""

import os
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont


W, H = 1080, 1920
FPS = 30
DUR = 20  # seconds

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG  = "/System/Library/Fonts/Supplemental/Arial.ttf"
# Linux fallbacks
ALT_BOLD  = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
ALT_REG   = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
ALT2_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
ALT2_REG  = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def _font(path, alt, size):
    for p in [path, alt, ALT2_BOLD if "Bold" in path else ALT2_REG]:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _draw_text_centered(draw, text, y_center, font, fill=(255, 255, 255, 255), maxw=1000):
    """Draw centered multi-line text with drop shadow."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textbbox((0, 0), test, font=font)[2] > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)

    lh = draw.textbbox((0, 0), "Ag", font=font)[3] + 12
    y = y_center - (lh * len(lines)) // 2
    for line in lines:
        bx = draw.textbbox((0, 0), line, font=font)[2]
        x = (W - bx) // 2
        draw.text((x + 3, y + 3), line, font=font, fill=(0, 0, 0, 200))
        draw.text((x, y), line, font=font, fill=fill)
        y += lh


def _np_gradient(size, alpha_max, reverse=False):
    g = np.linspace(0, 1, size, dtype=np.float32)
    if reverse:
        g = g[::-1]
    return (g * alpha_max).astype(np.uint8)


def _make_gradient_overlay(top_h=220, bot_h=260, alpha_max=200) -> Image.Image:
    arr = np.zeros((H, W, 4), dtype=np.uint8)
    if top_h > 0:
        top_a = _np_gradient(top_h, alpha_max, reverse=True)
        arr[:top_h, :, 3] = top_a[:, None]
    if bot_h > 0:
        bot_a = _np_gradient(bot_h, alpha_max, reverse=False)
        arr[H - bot_h:, :, 3] = bot_a[:, None]
    return Image.fromarray(arr, "RGBA")


def _make_dark_overlay(alpha=180) -> Image.Image:
    arr = np.zeros((H, W, 4), dtype=np.uint8)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr, "RGBA")


# Stereogram occupies the center: y = TOP_PAD to TOP_PAD + W (approx 420–1500)
TOP_PAD = (H - W) // 2   # ~420
BOT_START = TOP_PAD + W   # ~1500


def _make_hook_overlay(hook_text: str) -> Image.Image:
    """Phase 1 (0–4.5s): hook text in top zone, brand in bottom zone."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 200))
    d = ImageDraw.Draw(img)
    f_xl = _font(FONT_BOLD, ALT_BOLD, 130)
    f_lg = _font(FONT_BOLD, ALT_BOLD, 90)
    # Hook text centred in top zone
    _draw_text_centered(d, hook_text, TOP_PAD // 2, f_xl, fill=(255, 255, 255, 255))
    # Brand centred in bottom zone
    _draw_text_centered(d, "THE MAGIC EYE 3D", BOT_START + (H - BOT_START) // 2, f_lg, fill=(255, 220, 60, 255))
    return img


def _make_top_banner() -> Image.Image:
    """Brand name in top zone during reveal phase."""
    img = _make_gradient_overlay(top_h=TOP_PAD, bot_h=0, alpha_max=220)
    d = ImageDraw.Draw(img)
    f = _font(FONT_BOLD, ALT_BOLD, 90)
    _draw_text_centered(d, "THE MAGIC EYE 3D", TOP_PAD // 2, f, fill=(255, 220, 60, 255))
    return img


def _make_bot_banner(instruction: str, tip: str) -> Image.Image:
    """Instruction + tip in bottom zone during reveal phase."""
    img = _make_gradient_overlay(top_h=0, bot_h=H - BOT_START, alpha_max=220)
    d = ImageDraw.Draw(img)
    f_sm = _font(FONT_BOLD, ALT_BOLD, 80)
    f_tip = _font(FONT_REG, ALT_REG, 64)
    bot_zone_h = H - BOT_START  # ~420px
    _draw_text_centered(d, instruction, BOT_START + bot_zone_h // 3,       f_sm,  fill=(255, 255, 255, 255))
    _draw_text_centered(d, tip,         BOT_START + 2 * bot_zone_h // 3,   f_tip, fill=(180, 220, 255, 255))
    return img


def _make_cta_overlay(cta_main: str, cta_sub: str) -> Image.Image:
    """Full-frame dark CTA slide."""
    img = _make_dark_overlay(alpha=210)
    d = ImageDraw.Draw(img)
    f_xl = _font(FONT_BOLD, ALT_BOLD, 130)
    f_lg = _font(FONT_BOLD, ALT_BOLD, 96)
    f_md = _font(FONT_REG, ALT_REG, 72)
    _draw_text_centered(d, cta_main,                            H * 1 // 5, f_xl, fill=(255, 255, 255, 255))
    _draw_text_centered(d, cta_sub,                             H * 2 // 5, f_lg, fill=(255, 220, 60, 255))
    _draw_text_centered(d, "Like and Follow for more 3D magic", H * 3 // 5, f_md, fill=(100, 255, 120, 255))
    _draw_text_centered(d, "Follow The Magic Eye 3D",           H * 4 // 5, f_md, fill=(200, 200, 255, 255))
    return img


def _scale_pad(label: str) -> str:
    """FFmpeg filter to scale image to W×W and pad to W×H centered."""
    return (
        f"[{label}] scale={W}:{W}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1 [{label}_bg]"
    )


def create_reel(
    stereogram_path: str,
    output_path: str,
    depth_map_path: str = "",
    pattern_path: str = "",
    hook_text: str = "Can you see the hidden image",
    instruction_text: str = "Stare through the screen",
    cta_text: str = "Can you see it",
) -> str:
    """
    Create a 20-second 1080x1920 MP4 reel using FFmpeg filter_complex.

    Timeline:
      0  –  5s : Hook — pattern background + hook text
      5  – 15s : Stereogram reveal + top/bottom banners
      15 – 20s : CTA overlay
    """
    if not pattern_path or not os.path.exists(pattern_path):
        pattern_path = stereogram_path

    with tempfile.TemporaryDirectory() as tmpdir:
        # ── 1. Build overlay PNGs
        hook_img = _make_hook_overlay(hook_text)
        top_img  = _make_top_banner()
        bot_img  = _make_bot_banner(instruction_text, "Relax your eyes and look past the screen")
        cta_img  = _make_cta_overlay(cta_text, "Comment YES or NO below")

        hook_png = os.path.join(tmpdir, "hook.png")
        top_png  = os.path.join(tmpdir, "top.png")
        bot_png  = os.path.join(tmpdir, "bot.png")
        cta_png  = os.path.join(tmpdir, "cta.png")

        hook_img.save(hook_png)
        top_img.save(top_png)
        bot_img.save(bot_png)
        cta_img.save(cta_png)

        # ── 2. Timeline markers
        t_hook_end   = 5.0
        t_stereo_end = 15.0
        t_cta_start  = 15.0

        # Inputs: 0=pattern, 1=stereogram, 2=hook_ov, 3=top_ov, 4=bot_ov, 5=cta_ov
        fc = (
            # Scale image sources
            f"[0:v] scale={W}:{W}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1 [pat_bg];"

            f"[1:v] scale={W}:{W}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,"
            f"fade=t=out:st={DUR-0.8}:d=0.8 [ste_bg];"

            # Scale overlay PNGs
            f"[2:v] scale={W}:{H} [hook_ov];"
            f"[3:v] scale={W}:{H} [top_ov];"
            f"[4:v] scale={W}:{H} [bot_ov];"
            f"[5:v] scale={W}:{H} [cta_ov];"

            # Switch background: pattern → stereogram
            f"[pat_bg][ste_bg] overlay=0:0:enable='gte(t,{t_hook_end})':format=auto [bg];"

            # Apply overlays
            f"[bg][hook_ov] overlay=0:0:enable='between(t,0,{t_hook_end})':format=auto [f1];"
            f"[f1][top_ov]  overlay=0:0:enable='between(t,{t_hook_end},{t_stereo_end})':format=auto [f2];"
            f"[f2][bot_ov]  overlay=0:0:enable='between(t,{t_hook_end},{t_stereo_end})':format=auto [f3];"
            f"[f3][cta_ov]  overlay=0:0:enable='gte(t,{t_cta_start})':format=auto [out]"
        )

        # ── 3. Run FFmpeg
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-t", str(DUR), "-i", pattern_path,     # 0
            "-loop", "1", "-t", str(DUR), "-i", stereogram_path,   # 1
            "-loop", "1", "-t", str(DUR), "-i", hook_png,          # 2
            "-loop", "1", "-t", str(DUR), "-i", top_png,           # 3
            "-loop", "1", "-t", str(DUR), "-i", bot_png,           # 4
            "-loop", "1", "-t", str(DUR), "-i", cta_png,           # 5
            "-filter_complex", fc,
            "-map", "[out]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "24",
            "-pix_fmt", "yuv420p",
            "-r", str(FPS),
            "-t", str(DUR),
            output_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-2000:]}")

    return output_path


# ─────────────────────────────────────────────
# Kept for backwards compatibility
# ─────────────────────────────────────────────
def create_gradient_background(width, height, color_start, color_end):
    gradient = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        ratio = y / height
        r = int(color_start[0] * (1 - ratio) + color_end[0] * ratio)
        g = int(color_start[1] * (1 - ratio) + color_end[1] * ratio)
        b = int(color_start[2] * (1 - ratio) + color_end[2] * ratio)
        gradient[y, :] = [r, g, b]
    return Image.fromarray(gradient, mode="RGB")
