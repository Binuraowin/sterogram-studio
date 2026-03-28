import os
import base64
from datetime import date
from io import BytesIO
from typing import List


DESCRIPTIONS = [
    "Hidden inside was {obj}. A truly out-of-this-world illusion!",
    "Did you spot {obj}? A beautiful hidden surprise!",
    "This intricate pattern concealed {obj}. Could you see it?",
    "This one revealed {obj}. One of this week's trickiest reveals!",
    "Did you manage to uncover the {obj} in this challenging pattern?",
]


def _load_image_bytes(url: str) -> bytes | None:
    """Fetch image bytes from a URL or a local /static/ path."""
    if not url:
        return None
    try:
        if url.startswith("http"):
            import requests as req
            r = req.get(url, timeout=10)
            r.raise_for_status()
            return r.content
        else:
            # Local path like /static/stereogram_1.png?v=...
            clean = url.split("?")[0].lstrip("/")  # "static/stereogram_1.png"
            base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "generated_images")
            filename = os.path.basename(clean)
            filepath = os.path.join(base_dir, filename)
            with open(filepath, "rb") as f:
                return f.read()
    except Exception as e:
        print(f"[Thumbnail] Could not load image from {url}: {e}")
        return None


def generate_thumbnail(stereograms: list, title: str) -> bytes | None:
    """
    Build a 1200×630 thumbnail:
      - Left half: first stereogram
      - Right half: its depth map
      - White rounded text box at the bottom with the post title
    Returns PNG bytes, or None if Pillow is unavailable.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("[Thumbnail] Pillow not available — skipping thumbnail generation")
        return None

    THUMB_W, THUMB_H = 1200, 630
    HALF_W = THUMB_W // 2

    canvas = Image.new("RGB", (THUMB_W, THUMB_H), color=(20, 20, 30))

    # Pick the first stereogram that has images
    sg = next((s for s in stereograms if s.image_url), None)
    if sg:
        stereo_bytes = _load_image_bytes(sg.image_url)
        if stereo_bytes:
            stereo_img = Image.open(BytesIO(stereo_bytes)).convert("RGB")
            stereo_img = stereo_img.resize((HALF_W, THUMB_H), Image.LANCZOS)
            canvas.paste(stereo_img, (0, 0))

        depth_url = getattr(sg, "depth_map_url", None)
        if depth_url:
            depth_bytes = _load_image_bytes(depth_url)
            if depth_bytes:
                depth_img = Image.open(BytesIO(depth_bytes)).convert("RGB")
                depth_img = depth_img.resize((HALF_W, THUMB_H), Image.LANCZOS)
                canvas.paste(depth_img, (HALF_W, 0))

    # --- Text overlay ---
    PADDING = 40
    BOX_H = 230
    RADIUS = 24
    box_y = THUMB_H - BOX_H - PADDING
    box_rect = [PADDING, box_y, THUMB_W - PADDING, THUMB_H - PADDING]

    # White semi-transparent box via RGBA compositing
    overlay = Image.new("RGBA", (THUMB_W, THUMB_H), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rounded_rectangle(box_rect, radius=RADIUS, fill=(255, 255, 255, 230))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")

    draw = ImageDraw.Draw(canvas)

    FONT_SIZE = 68
    font = None
    for font_path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            font = ImageFont.truetype(font_path, FONT_SIZE)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    # Word-wrap title to fit inside the box
    max_text_w = THUMB_W - PADDING * 4
    words = title.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        test = " ".join(current + [word])
        w = draw.textbbox((0, 0), test, font=font)[2]
        if w <= max_text_w:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))

    LINE_H = FONT_SIZE + 12
    total_text_h = len(lines) * LINE_H
    text_y = box_y + (BOX_H - total_text_h) // 2

    for line in lines:
        lw = draw.textbbox((0, 0), line, font=font)[2]
        draw.text(((THUMB_W - lw) // 2, text_y), line, fill=(15, 15, 25), font=font)
        text_y += LINE_H

    buf = BytesIO()
    canvas.save(buf, "PNG")
    return buf.getvalue()


def _upload_wp_media(image_bytes: bytes, filename: str, wp_url: str, credentials: str) -> int | None:
    """Upload image to WP media library. Returns media ID."""
    import requests as req
    try:
        r = req.post(
            f"{wp_url}/wp-json/wp/v2/media",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "image/png",
            },
            data=image_bytes,
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["id"]
    except Exception as e:
        print(f"[WP Media] Upload failed: {e}")
        return None


def generate_post_content(stereograms: list, post_date: date) -> dict:
    date_str = post_date.strftime("%B %d, %Y")
    title = "Can You Spot Them? This Week's 5 Must-See Stereogram Reveals"

    intro = (
        "<p><strong>Sharpen your eyes—it's reveal time!</strong></p>"
        "<p>Each week, we challenge you with mind-bending stereograms, and now we're uncovering "
        "the top 5 hidden images from this week's collection. Whether you spotted them instantly "
        "or struggled with a few, here's your chance to finally see what was hiding behind those "
        "hypnotic 3D patterns.</p>"
        "<p>Dive in and explore each stereogram's secret image, depth details, and source.<br>"
        "Did you manage to spot all five? Let's find out!</p>"
    )

    items_html = ""
    for i, sg in enumerate(stereograms[:5], 1):
        desc = DESCRIPTIONS[(i - 1) % len(DESCRIPTIONS)].format(obj=sg.hidden_object.lower())
        stereo_tag = (
            f'<figure class="wp-block-image"><img src="{sg.image_url}" '
            f'alt="Stereogram #{i} – {sg.hidden_object}" /></figure>'
            if sg.image_url else ""
        )
        depth_tag = (
            f'<figure class="wp-block-image"><img src="{sg.depth_map_url}" '
            f'alt="Hidden object reveal – {sg.hidden_object}" /></figure>'
            if getattr(sg, "depth_map_url", None) else ""
        )
        items_html += (
            f"<h3>Stereogram #{i} — The Reveal</h3>"
            f"{stereo_tag}"
            f"<p><strong>Hidden object:</strong> {sg.hidden_object}</p>"
            f"{depth_tag}"
            f"<p>{desc}</p>"
            f"<hr/>"
        )

    how_to = (
        "<h3>How to See the Hidden Images:</h3>"
        "<p>Struggling to catch the illusions? Here are some pro tips to help you get better:</p>"
        "<ul>"
        "<li>Let your eyes relax—don't focus directly on the image.</li>"
        "<li>Imagine you're looking <em>through</em> the screen, not at it.</li>"
        "<li>Slowly adjust your gaze until the hidden object pops out.</li>"
        "<li>Some people find it easier when they slightly cross their eyes, while others need bright lighting.</li>"
        "<li>With a bit of practice, anyone can master the magic of stereograms!</li>"
        "</ul>"
    )

    cta = (
        "<h3>Join the Conversation!</h3>"
        "<p>Which one was your favorite this week? Drop your thoughts in the comments on our "
        "Facebook Page, and tell us how many you solved! 📬</p>"
        "<p>Want more illusions and weekly brain boosters? Make sure to follow us and turn on "
        "notifications—we've got a brand new set of stereograms coming next week!</p>"
        "<p><em>See you soon, illusion lovers! 👀🌀</em></p>"
    )

    content = intro + items_html + how_to + cta

    return {
        "title": title,
        "content": content,
        "date": date_str,
        "tags": [
            "3d images", "autostereograms", "depth perception",
            "hidden 3D images", "magic eye", "optical illusions",
            "stereogram viewing techniques", "visual effects",
        ],
        "stereogram_count": len(stereograms[:5]),
    }


def publish_to_wordpress(title: str, content: str, status: str = "draft", stereograms: list | None = None) -> dict:
    import requests as req

    wp_url = os.environ.get("WP_URL", "").rstrip("/")
    wp_user = os.environ.get("WP_USER", "")
    wp_app_password = os.environ.get("WP_APP_PASSWORD", "")

    if not all([wp_url, wp_user, wp_app_password]):
        raise ValueError("WordPress credentials not configured (WP_URL, WP_USER, WP_APP_PASSWORD)")

    credentials = base64.b64encode(f"{wp_user}:{wp_app_password}".encode()).decode()
    auth_headers = {
        "Authorization": f"Basic {credentials}",
        "Content-Type": "application/json",
    }

    # Generate and upload thumbnail as featured image
    featured_media_id = None
    if stereograms:
        thumb_bytes = generate_thumbnail(stereograms, title)
        if thumb_bytes:
            featured_media_id = _upload_wp_media(thumb_bytes, "stereogram-reveal-thumbnail.png", wp_url, credentials)
            if featured_media_id:
                print(f"[WP Media] Thumbnail uploaded, media ID: {featured_media_id}")

    post_payload: dict = {"title": title, "content": content, "status": status}
    if featured_media_id:
        post_payload["featured_media"] = featured_media_id

    response = req.post(
        f"{wp_url}/wp-json/wp/v2/posts",
        json=post_payload,
        headers=auth_headers,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    return {"wp_post_id": data["id"], "wp_post_url": data.get("link", "")}


def is_wordpress_configured() -> bool:
    return bool(
        os.environ.get("WP_URL")
        and os.environ.get("WP_USER")
        and os.environ.get("WP_APP_PASSWORD")
    )
