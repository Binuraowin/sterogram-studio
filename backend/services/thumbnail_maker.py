from PIL import Image, ImageDraw, ImageFont
import numpy as np


FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def create_thumbnail(
    stereogram_path: str,
    output_path: str,
    hook_text: str = "Can you see it?",
) -> str:
    """
    Create a 1080x1080 thumbnail PNG from a stereogram with hook text overlay.
    
    Args:
        stereogram_path: Path to input stereogram PNG
        output_path: Path to output thumbnail PNG
        hook_text: Text to display on banner
    
    Returns:
        Path to generated thumbnail
    """
    
    # Load stereogram
    stereo_img = Image.open(stereogram_path).convert("RGB")
    
    # Resize to 1080x1080
    stereo_resized = stereo_img.resize((1080, 1080), Image.Resampling.LANCZOS)
    
    # Create gradient banner at top
    banner_height = 200
    gradient = np.zeros((banner_height, 1080, 3), dtype=np.uint8)
    for y in range(banner_height):
        ratio = y / banner_height
        # Dark to medium gradient
        r = int(20 * (1 - ratio) + 40 * ratio)
        g = int(20 * (1 - ratio) + 40 * ratio)
        b = int(20 * (1 - ratio) + 40 * ratio)
        gradient[y, :] = [r, g, b]
    
    banner_img = Image.fromarray(gradient, mode="RGB")
    
    # Create thumbnail with banner on top
    thumbnail = Image.new("RGB", (1080, 1080), (0, 0, 0))
    thumbnail.paste(banner_img, (0, 0))
    thumbnail.paste(stereo_resized, (0, banner_height - 20))
    
    # Draw text on banner
    draw = ImageDraw.Draw(thumbnail)
    try:
        font = ImageFont.truetype(FONT_BOLD, 50)
    except:
        font = ImageFont.load_default()
    
    # Wrap text if needed
    lines = []
    words = hook_text.split()
    current_line = ""
    for word in words:
        test_line = current_line + " " + word if current_line else word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] > 1000:
            if current_line:
                lines.append(current_line)
            current_line = word
        else:
            current_line = test_line
    if current_line:
        lines.append(current_line)
    
    # Center text in banner
    line_height = 60
    total_height = len(lines) * line_height
    start_y = (banner_height - total_height) // 2
    
    for i, line in enumerate(lines):
        y = start_y + i * line_height
        bbox = draw.textbbox((0, 0), line, font=font)
        x = (1080 - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, fill=(255, 255, 255), font=font)
    
    # Save thumbnail
    thumbnail.save(output_path, "PNG")
    return output_path
