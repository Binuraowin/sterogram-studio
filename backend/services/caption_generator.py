import json
import os


def generate_captions(subject: str, palette: str = "", content_type: str = "stereogram") -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    is_illusion = content_type == "illusion"
    type_name = "optical illusion" if is_illusion else "Magic Eye stereogram"
    view_hint = (
        "look at the image — your brain automatically perceives a hidden shape embedded within the visual pattern"
        if is_illusion else
        "relax your eyes, stare through the screen, and the hidden 3D shape slowly pops out"
    )
    hashtags = (
        "#OpticalIllusion #IllusionArt #BrainTeaser #MindBending #VisualIllusion #HiddenImage #Perception"
        if is_illusion else
        "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #BrainTeaser #VisualPuzzle #HiddenImage"
    )

    prompt = f"""You are a social media expert creating Facebook post captions for a {type_name} image.

The hidden subject is: {subject}
How to view it: {view_hint}
Hashtags to use: {hashtags}

Return exactly this JSON (no markdown, no extra text):
{{
  "variation_a": {{"label": "Challenge / FOMO", "caption": "..."}},
  "variation_b": {{"label": "Educational / Story", "caption": "..."}},
  "variation_c": {{"label": "Short & Punchy", "caption": "..."}}
}}

Rules per variation:
- variation_a: Challenge angle — "only X% can see this", strong FOMO, CTA to comment YES/NO, include all hashtags
- variation_b: Educational or nostalgic — explain the science of how the brain perceives hidden patterns, or invoke nostalgia; include all hashtags
- variation_c: Ultra-short — 3 lines max, punchy hook, minimal hashtags (3-4 only)
- 2-4 emojis per caption used naturally, not clustered at the end
- End each caption with a clear CTA (comment, tag someone, share, react)
- Captions must feel human and authentic, not like ad copy
- {"Focus on how the brain finds hidden patterns, perception tricks, mind-bending visual science" if is_illusion else "Focus on the 3D depth illusion, relaxed-eye technique, childhood Magic Eye nostalgia"}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if "```" in text:
            text = text[: text.rfind("```")]
        text = text.strip()

    return json.loads(text)
