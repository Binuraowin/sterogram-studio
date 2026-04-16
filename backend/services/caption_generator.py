import random


SUBJECT_CAPTIONS = {
    "dolphin": {
        "hook": "Only 1 in 20 people can see this immediately",
        "instruction": "Relax your eyes and stare at the center. The magic happens in 3D.",
        "cta": "Did you see the dolphin? Comment YES if you did",
        "follow": "Follow for more mind-bending illusions",
        "hashtags": "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #BrainTeaser #VisualPuzzle #HiddenImage",
    },
    "heart": {
        "hook": "Can you see the hidden shape without looking away?",
        "instruction": "Stare and let your eyes relax. You'll see it pop out in 3D.",
        "cta": "Comment HEART if you spotted it",
        "follow": "Follow for more mysterious visual puzzles",
        "hashtags": "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #HiddenImage #VisualPuzzle #BrainTeaser",
    },
    "eagle": {
        "hook": "This hidden image will blow your mind",
        "instruction": "Focus on the center. Blink slowly. The hidden shape will emerge.",
        "cta": "Can you see the eagle? Comment below",
        "follow": "Follow for more eye-bending illusions",
        "hashtags": "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #BrainTeaser #VisualPuzzle #HiddenImage",
    },
    "star": {
        "hook": "Only masters can spot this",
        "instruction": "Look through the image, not at it. You'll see the magic unfold.",
        "cta": "Did you catch the star? React with a star emoji",
        "follow": "Follow for daily visual brain teasers",
        "hashtags": "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #VisualPuzzle #BrainTeaser #HiddenImage",
    },
}


def generate_captions(subject: str, palette: str = "rainbow") -> dict:
    """
    Generate caption variations for a given subject.
    
    Args:
        subject: Subject name (dolphin, heart, eagle, star, or custom text)
        palette: Color palette used (for context, but not used in caption generation)
    
    Returns:
        Dictionary with caption variations
    """
    
    subject_lower = subject.lower().strip()
    
    # Get template for known subjects, otherwise create generic caption
    if subject_lower in SUBJECT_CAPTIONS:
        template = SUBJECT_CAPTIONS[subject_lower]
    else:
        # Generic template for custom subjects
        template = {
            "hook": f"Can you see the hidden {subject}?",
            "instruction": "Relax your eyes and stare at the center to see the 3D magic.",
            "cta": f"Did you see the {subject}? Comment YES below",
            "follow": "Follow for more mind-bending visual illusions",
            "hashtags": "#MagicEye #Stereogram #3DIllusion #OpticalIllusion #VisualPuzzle #BrainTeaser #HiddenImage",
        }
    
    # Create variations with slight modifications
    variations = {}
    
    # Variation A: Competitive
    caption_a = (
        f"{template['hook']}\n\n"
        f"{template['instruction']}\n\n"
        f"{template['cta']}\n\n"
        f"{template['follow']}\n\n"
        f"{template['hashtags']}"
    )
    variations["variation_a"] = {
        "label": "High-Competition — Challenge Yourself",
        "caption": caption_a,
    }
    
    # Variation B: Nostalgic
    hook_b = "Remember these from the 90s?"
    caption_b = (
        f"{hook_b}\n\n"
        f"{template['instruction']}\n\n"
        f"{template['cta']}\n\n"
        f"Tag someone who loved these\!\n\n"
        f"{template['hashtags']}"
    )
    variations["variation_b"] = {
        "label": "Nostalgic — 90s Kids Remember",
        "caption": caption_b,
    }
    
    # Variation C: Short & Punchy
    caption_c = (
        f"{template['hook']}\n\n"
        f"Comment your answer\n\n"
        f"{template['hashtags']}"
    )
    variations["variation_c"] = {
        "label": "Short & Punchy — Don't Blink",
        "caption": caption_c,
    }
    
    return variations
