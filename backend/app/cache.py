import hashlib
import json
from app.util import get_root_folder

CACHE_VERSION = "v1"

def compute_cache_key(path):
    content = path.read_bytes()
    return hashlib.md5(content + CACHE_VERSION.encode()).hexdigest()

def get_cache_path(scene_id, layer, key):
    base = get_root_folder() / "scenes" / scene_id / "preprocessed"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{layer}_{key}.json"

def load_cache(scene_id, layer, key):
    path = get_cache_path(scene_id, layer, key)
    if path.exists():
        return json.loads(path.read_text())
    return None

def save_cache(scene_id, layer, key, data):
    path = get_cache_path(scene_id, layer, key)
    path.write_text(json.dumps(data))
