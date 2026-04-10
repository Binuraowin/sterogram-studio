import os
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = os.environ.get("SUPABASE_BUCKET", "stereograms")

_client = None


def is_available() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def _get_client():
    global _client
    if _client is None:
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def upload_image(filepath: str, filename: str) -> str:
    """Upload a PNG file to Supabase Storage and return its public URL."""
    client = _get_client()

    with open(filepath, "rb") as f:
        data = f.read()

    # Upsert — overwrites existing file on regeneration
    client.storage.from_(BUCKET_NAME).upload(
        path=filename,
        file=data,
        file_options={"content-type": "image/png", "upsert": "true"},
    )

    public_url = client.storage.from_(BUCKET_NAME).get_public_url(filename)
    return f"{public_url}?v={int(time.time())}"
