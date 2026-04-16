import math
import random
from PIL import Image, ImageDraw


def _get_palette(color_mode: str) -> list[tuple[int, int, int]]:
    """Return 3 face colors based on color_mode."""
    if color_mode == "warm":
        return [(220, 80, 60), (180, 50, 30), (240, 140, 100)]
    elif color_mode == "cool":
        return [(60, 110, 200), (30, 70, 160), (100, 160, 230)]
    elif color_mode == "festive":
        return [(200, 40, 40), (40, 160, 40), (220, 190, 30)]
    else:
        # random — pick a random hue family
        r = random.randint(0, 3)
        palettes = [
            [(180, 60, 200), (130, 30, 160), (210, 120, 230)],  # purple
            [(50, 160, 140), (20, 110, 90), (90, 200, 180)],   # teal
            [(200, 130, 40), (150, 90, 10), (230, 180, 90)],   # gold
            [(60, 110, 200), (30, 70, 160), (100, 160, 230)],  # blue
        ]
        return palettes[r]


def _iso_to_screen(ix: float, iy: float, iz: float, cx: float, cy: float, scale: float):
    """Convert isometric (ix, iy, iz) coordinates to screen (x, y)."""
    sx = cx + (ix - iy) * scale * math.cos(math.radians(30))
    sy = cy + (ix + iy) * scale * math.sin(math.radians(30)) - iz * scale
    return (sx, sy)


def _penrose_triangle(width: int, height: int, color_mode: str) -> Image.Image:
    img = Image.new("RGB", (width, height), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    colors = _get_palette(color_mode)

    cx, cy = width / 2, height / 2
    scale = min(width, height) * 0.18

    # The Penrose triangle uses 3 beams arranged in a triangle.
    # Each beam is a parallelogram (top face / right face / left face).
    # We draw them so the near ends overlap inconsistently, creating the impossibility.

    thick = max(int(min(width, height) * 0.055), 8)

    # Vertices of an equilateral triangle in screen space (for beam centers)
    tri_r = min(width, height) * 0.28
    angles = [90, 210, 330]
    verts = []
    for a in angles:
        rad = math.radians(a)
        verts.append((cx + tri_r * math.cos(rad), cy - tri_r * math.sin(rad)))

    # Draw 3 thick beams along each edge
    beam_colors = colors
    for i in range(3):
        p1 = verts[i]
        p2 = verts[(i + 1) % 3]
        draw.line([p1, p2], fill=beam_colors[i], width=thick)

    # Now draw 3D notches at each corner to create the impossible depth illusion
    # At each corner, one beam appears to pass in front of another
    notch = thick // 2
    for i in range(3):
        p1 = verts[i]
        p2 = verts[(i + 1) % 3]
        # Direction perpendicular to beam
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        nx, ny = -dy / length, dx / length

        # Draw a corner cap that breaks the expected depth order
        cap_size = thick * 0.9
        corner = verts[(i + 2) % 3]
        # Light face
        lf = [
            (corner[0] + nx * cap_size, corner[1] + ny * cap_size),
            (corner[0] - nx * cap_size, corner[1] - ny * cap_size),
            (corner[0] - nx * cap_size + dx / length * thick, corner[1] - ny * cap_size + dy / length * thick),
            (corner[0] + nx * cap_size + dx / length * thick, corner[1] + ny * cap_size + dy / length * thick),
        ]
        draw.polygon(lf, fill=beam_colors[(i + 2) % 3])

    # Outline
    for i in range(3):
        p1 = verts[i]
        p2 = verts[(i + 1) % 3]
        draw.line([p1, p2], fill=(30, 30, 30), width=max(3, thick // 6))

    # Draw corner blocks with proper shading to sell the impossible geometry
    corner_size = thick * 1.1
    for i in range(3):
        v = verts[i]
        # Draw a small square at each vertex in the "front" color to create illusion of overlap
        draw.ellipse(
            [v[0] - corner_size / 2, v[1] - corner_size / 2,
             v[0] + corner_size / 2, v[1] + corner_size / 2],
            fill=beam_colors[i], outline=(30, 30, 30), width=2
        )

    return img


def _necker_cube(width: int, height: int, color_mode: str) -> Image.Image:
    img = Image.new("RGB", (width, height), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    colors = _get_palette(color_mode)

    cx, cy = width / 2, height / 2
    scale = min(width, height) * 0.22

    # 8 corners of a unit cube in isometric coords
    def pt(ix, iy, iz):
        return _iso_to_screen(ix, iy, iz, cx, cy, scale)

    # Front face (z=1), back face (z=0)
    f = [pt(0, 0, 1), pt(1, 0, 1), pt(1, 1, 1), pt(0, 1, 1)]
    b = [pt(0, 0, 0), pt(1, 0, 0), pt(1, 1, 0), pt(0, 1, 0)]

    # Fill faces with semi-transparent colors
    # Top face
    top = [f[0], f[1], b[1], b[0]]
    draw.polygon(top, fill=colors[0])
    # Right face
    right = [f[1], f[2], b[2], b[1]]
    draw.polygon(right, fill=colors[1])
    # Front face
    draw.polygon(f, fill=colors[2])

    thick_front = max(4, int(min(width, height) * 0.012))
    thick_back = max(2, thick_front // 2)

    # Back edges (dashed feel — draw thinner)
    back_edges = [(0, 1), (1, 2), (2, 3), (3, 0)]
    for i, j in back_edges:
        draw.line([b[i], b[j]], fill=(80, 80, 80), width=thick_back)

    # Connecting edges (corners front-to-back)
    for i in range(4):
        draw.line([f[i], b[i]], fill=(60, 60, 60), width=thick_back)

    # Front edges (bold)
    front_edges = [(0, 1), (1, 2), (2, 3), (3, 0)]
    for i, j in front_edges:
        draw.line([f[i], f[j]], fill=(20, 20, 20), width=thick_front)

    # The ambiguity: draw back face outline equally bold so the eye can't decide which face is front
    for i, j in back_edges:
        draw.line([b[i], b[j]], fill=(20, 20, 20), width=thick_front)

    return img


def _penrose_stairs(width: int, height: int, color_mode: str) -> Image.Image:
    img = Image.new("RGB", (width, height), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    colors = _get_palette(color_mode)

    cx, cy = width / 2, height / 2
    scale = min(width, height) * 0.13

    def pt(ix, iy, iz):
        return _iso_to_screen(ix, iy, iz, cx, cy, scale)

    step_count = 4  # steps per side
    side_count = 4  # 4 sides forming the loop

    # Build stair sections. Each side goes in one iso direction.
    # Directions: +x, +y, -x, -y
    # Heights cycle: staircase rises across all 4 sides but "loops" impossibly

    total_steps = step_count * side_count
    step_height = 0.5  # vertical rise per step

    # Draw each step as a top face + front face rectangle
    # We'll lay out steps around a square loop
    positions = []
    ix, iy, iz = 0.0, 0.0, 0.0
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]

    for side in range(side_count):
        dx, dy = dirs[side]
        shade = [
            tuple(max(0, c - 30 * side) for c in colors[side % 3])
            for _ in range(step_count)
        ]
        for step in range(step_count):
            # Top face of this step
            top = [
                pt(ix, iy, iz + step_height),
                pt(ix + dx, iy + dy, iz + step_height),
                pt(ix + dx, iy + dy, iz + step_height - 0.15),
                pt(ix, iy, iz + step_height - 0.15),
            ]
            # Front face
            front = [
                pt(ix, iy, iz + step_height),
                pt(ix + dx, iy + dy, iz + step_height),
                pt(ix + dx, iy + dy, iz),
                pt(ix, iy, iz),
            ]

            face_color = shade[step]
            top_color = tuple(min(255, c + 40) for c in face_color)

            draw.polygon(front, fill=face_color)
            draw.polygon(top, fill=top_color)

            # Outline
            draw.line(list(top) + [top[0]], fill=(30, 30, 30), width=2)
            draw.line(list(front) + [front[0]], fill=(30, 30, 30), width=2)

            ix += dx * 1
            iy += dy * 1
            iz += step_height  # keep rising — the last side connects back impossibly

    return img


def generate_impossible_object(object_type: str, width: int, height: int, color_mode: str) -> Image.Image:
    if object_type == "necker_cube":
        return _necker_cube(width, height, color_mode)
    elif object_type == "penrose_stairs":
        return _penrose_stairs(width, height, color_mode)
    else:
        return _penrose_triangle(width, height, color_mode)
