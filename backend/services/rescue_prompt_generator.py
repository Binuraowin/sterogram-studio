import os
import json
import re

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

_client = None

# ── Style prompt blocks ────────────────────────────────────────────────────────

_CCTV_PROMPT_BLOCK = """
Study these EXAMPLES and match this quality exactly:

EXAMPLE SCENE: "A small puppy is found shivering behind a market on a rainy night"

EXAMPLE Image 1: "CCTV security camera still frame, overhead corner-mounted wide-angle lens, grainy low-resolution surveillance footage texture, muted desaturated color palette, faint green night-vision cast, white timestamp digits visible in bottom-right corner, wet concrete alley behind a market at night, neon signs blurred in background, a small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat, huddled tightly against soggy collapsed cardboard boxes, entire body shaking from cold, eyes wide and frightened, no humans present yet, authentic unstaged surveillance camera aesthetic, looks exactly like real CCTV footage — not a DSLR photo, not a movie still, not illustrated"

EXAMPLE Image 2: "CCTV security camera still frame, same overhead corner-mounted wide-angle lens, same grainy low-resolution surveillance texture, same muted desaturated palette with night-vision green tint, timestamp a few minutes later, same small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat, still on wet concrete, a person in a dark hooded raincoat visible from above crouching down with one arm extended toward the puppy, palm open and low to the ground, puppy's nose stretched forward sniffing the hand, one paw slightly lifted, moment of first contact about to happen, looks exactly like real CCTV footage — not a DSLR photo, not a movie still, not illustrated"

EXAMPLE Image 3: "CCTV security camera still frame, same overhead corner-mounted wide-angle lens, same grainy low-resolution surveillance texture, warmer indoor lighting replacing the night-vision cast, timestamp 20 minutes later, same small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat, now wrapped inside the person's raincoat against their chest, only the puppy's head and front paws visible poking out, eyes half-closed in exhaustion and relief, person walking toward the edge of frame cradling the puppy, looks exactly like real CCTV footage — not a DSLR photo, not a movie still, not illustrated"

EXAMPLE Video 1: "Realistic CCTV security camera footage, fixed wide-angle overhead angle mounted on market back wall, grainy low-light night vision texture with slight green tint, timestamp overlay showing late evening hour, the small tan and white puppy huddled against cardboard boxes shivering visibly — then a person in a dark raincoat enters the bottom-left corner mid-stride, pauses, notices the puppy, slowly crouches all the way down with one hand extended palm-up, puppy lifts its head with ears perked, locks eyes, slowly inches one paw forward, the moment of first physical contact captured by the static CCTV camera from above, no camera movement whatsoever"

EXAMPLE Video 2: "Realistic CCTV security camera footage, same fixed overhead angle and grainy night-vision texture, timestamp a few minutes later, the person now sitting on the wet ground holding the shivering puppy against their chest, puppy's tail beginning a slow cautious wag, person gently tucking the puppy inside their open raincoat, standing up carefully, taking slow steps toward the edge of the frame, pausing once to look down at the puppy's face resting on their forearm, the static CCTV camera watches as they disappear off-frame into safety, no zoom no pan no camera movement"

Now write ALL prompts at this EXACT level of detail for the actual scene above.

For each image prompt: Start with "CCTV security camera still frame, overhead corner-mounted wide-angle lens, grainy low-resolution surveillance footage texture" and end with "looks exactly like real CCTV footage — not a DSLR photo, not a movie still, not illustrated"
For video prompts: Static mounted camera only, human physically enters frame and rescues the animal step by step.

CRITICAL VIDEO PROMPT RULES — violations will cause the video API to reject the request:
- NEVER use: bleeding, blood, wound, injured, yelping, crying, screaming, contorted, writhing, pain, hurt, limping, gore
- Describe the animal's STATE using posture and behavior only (e.g. "still", "tense", "ears flat", "tail tucked", "not moving")
- Describe the RESCUE ACTION, not the injury
- Keep animal suffering implied through stillness and the rescuer's urgency — never stated explicitly
"""

_NATURAL_PROMPT_BLOCK = """
Study these EXAMPLES and match this quality exactly:

EXAMPLE SCENE: "A small puppy is found shivering behind a market on a rainy night"

EXAMPLE Image 1: "Photojournalism documentary photograph, ground-level perspective, handheld camera feel, natural available light from distant street lamps casting a cold blue-orange glow, shallow depth of field on the subject with soft background, rain-slicked alley pavement behind a market at night, a small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat, shivering against a pile of wet cardboard boxes, eyes wide and glistening with fear, ears flat, tiny body trembling, no humans in frame yet, authentic candid animal photography, realistic, not illustrated, not CGI, not studio-lit"

EXAMPLE Image 2: "Photojournalism documentary photograph, ground-level perspective, natural light, same rain-slicked alley setting, same small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat, a person's hand entering the frame from the left at ground level, palm open and relaxed, offered gently toward the puppy, the puppy stretching its nose forward sniffing cautiously, one paw slightly raised, moment of first trust captured in a single frame, authentic candid rescue photography, realistic, not illustrated, not CGI, not studio-lit"

EXAMPLE Image 3: "Photojournalism documentary photograph, close-up natural framing, warm indoor lighting from overhead fluorescents, same small 8-week-old beagle-mix puppy with tan and white fur, mud-matted coat now drying slightly, cradled against a person's chest wrapped in the person's jacket, the puppy's eyes half-closed with exhaustion and relief, small head resting on the person's forearm, the person's chin visible looking down with warmth, authentic candid rescue photography, realistic, not illustrated, not CGI, not studio-lit"

EXAMPLE Video 1: "Natural handheld documentary footage, ground-level wide shot, cold night ambient lighting from street lamps, the small tan and white puppy shivering against the wet cardboard boxes — a person walks into frame from the left, slows as they spot the puppy, crouches down to the ground, speaks softly with one hand extended low and open, the puppy flinches then holds still, sniffs the air, inches one paw forward, the person stays perfectly still letting the puppy come to them, the moment their fingers touch the puppy's wet nose, puppy's tail gives one tiny uncertain wag, all captured in one continuous natural shot"

EXAMPLE Video 2: "Natural handheld documentary footage, warm close-medium framing, the person now fully on the ground with the puppy in their lap, gently stroking the puppy's head with two fingers, the puppy's shivering slowly stopping as warmth transfers, person carefully unzipping their jacket and wrapping it around the puppy, lifting them both up from the ground in one careful motion, the puppy's face peeking out from inside the jacket resting against the person's chest, they begin walking away from the alley toward light and safety, heartwarming and raw"

Now write ALL prompts at this EXACT level of detail for the actual scene above.

For each image prompt: Use ground-level perspective, natural available lighting, photojournalism/documentary aesthetic. End with "realistic, not illustrated, not CGI, not studio-lit"
For video prompts: Natural handheld camera feel, human physically approaches and rescues the animal in real steps, warm and emotional.

CRITICAL VIDEO PROMPT RULES — violations will cause the video API to reject the request:
- NEVER use: bleeding, blood, wound, injured, yelping, crying, screaming, contorted, writhing, pain, hurt, limping, gore
- Describe the animal's STATE using posture and behavior only (e.g. "still", "tense", "ears flat", "tail tucked", "not moving")
- Describe the RESCUE ACTION, not the injury
- Keep animal suffering implied through stillness and the rescuer's urgency — never stated explicitly
"""


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def generate_rescue_prompts(scene: str, style: str = "natural") -> dict:
    """
    Given a rescue scene description, returns:
      image_prompts: list of 3 cinematic image prompts (opening, middle, ending)
      video_prompts: list of 2 video motion prompts
      caption: Facebook Reel caption with hook + hashtags
    """
    client = _get_client()
    is_cctv = style == "cctv"

    _video_policy = (
        "IMPORTANT: Video prompts must NEVER contain the words: "
        "bleeding, blood, wound, injured, yelping, crying, screaming, contorted, writhing, pain, hurt, limping, gore. "
        "Describe animal distress through posture only. Violations cause API rejection."
    )

    if is_cctv:
        system = (
            "You are a prompt writer for animal rescue Facebook Reels. "
            "You write CCTV security-camera-style image and video prompts — overhead angle, grainy, static camera, timestamp overlays, never cinematic. "
            f"{_video_policy} "
            "Always respond with valid JSON only — no markdown, no code fences, no explanation."
        )
        style_block = _CCTV_PROMPT_BLOCK
    else:
        system = (
            "You are a prompt writer for animal rescue Facebook Reels. "
            "You write natural documentary/photojournalism-style image and video prompts — ground-level, realistic lighting, candid, emotional but never overly cinematic or studio-lit. "
            f"{_video_policy} "
            "Always respond with valid JSON only — no markdown, no code fences, no explanation."
        )
        style_block = _NATURAL_PROMPT_BLOCK

    user = f"""Scene description: "{scene}"

Step 1 — Define the subject ONCE with exact physical details (breed, fur color, markings, age, size, condition). Use this EXACT same subject description word-for-word in all 3 image prompts.

{style_block}

Return exactly this JSON:
{{
  "image_prompts": ["<opening frame prompt>", "<middle frame prompt>", "<ending frame prompt>"],
  "video_prompts": ["<video 1 prompt: opening→middle>", "<video 2 prompt: middle→ending>"],
  "caption": "<Facebook Reel caption with emotional hook, story, call-to-action, 5-8 hashtags>"
}}

Rules (apply to ALL outputs):
- CRITICAL: The subject must have identical breed, color, markings, age, and condition in ALL 3 image prompts — copy the description exactly
- CRITICAL: Replace every [bracketed placeholder] with specific scene detail — no brackets in the final output
- CRITICAL: Human rescuer must physically enter and interact — crouching, reaching, touching, carrying
- Caption opens with a punchy hook sentence"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    content = message.content[0].text.strip()

    # Strip markdown code fences if model added them
    content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.MULTILINE)
    content = re.sub(r"```\s*$", "", content, flags=re.MULTILINE)
    content = content.strip()

    return json.loads(content)
