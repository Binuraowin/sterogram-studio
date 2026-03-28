import os
import json


SYSTEM_PROMPT = "You are a Senior Social Media Strategist specializing in viral visual puzzles. You write Facebook captions for Magic Eye 3D stereogram posts. Always respond with valid JSON only — no extra text, no markdown."

USER_TEMPLATE = """Generate 3 Facebook caption variations for a Magic Eye stereogram where the hidden object is "{hidden_object}" and the background pattern is "{background_pattern}".

Each caption must include:
1. Hook: Bold competitive statement
2. Instruction: How to see it as an insider secret
3. Micro-Challenge: Specific goal naming the hidden object
4. Social Trigger: Force a comment or share
5. Hashtags: 5-7 from #MagicEye #Stereogram #3DIllusion #BrainTeaser #VisualPuzzle #HiddenImage #OpticalIllusion

Tone: Mysterious, challenging, community-focused.

Return ONLY this JSON:
{{
  "variation_a": {{"label": "High-Competition — Only 1% can", "caption": "..."}},
  "variation_b": {{"label": "Nostalgic — 90s kids remember", "caption": "..."}},
  "variation_c": {{"label": "Short & Punchy — Don't Blink", "caption": "..."}}
}}"""


def generate_captions(hidden_object: str, background_pattern: str) -> dict:
    hf_token = os.environ.get("HF_TOKEN", "")
    if not hf_token:
        raise ValueError("HF_TOKEN is not configured.")

    from huggingface_hub import InferenceClient

    client = InferenceClient(
        model="Qwen/Qwen2.5-7B-Instruct",
        token=hf_token,
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_TEMPLATE.format(
            hidden_object=hidden_object,
            background_pattern=background_pattern,
        )},
    ]

    response = client.chat_completion(
        messages=messages,
        max_tokens=1200,
        temperature=0.7,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if "```" in raw:
        parts = raw.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                raw = part
                break

    # Extract JSON object from the response
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON found in model response: {raw[:300]}")
    raw = raw[start:end]

    data = json.loads(raw)
    return data
