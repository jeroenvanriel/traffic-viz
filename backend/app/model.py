from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import uuid
from app.util import get_root_folder
import os
import json

router = APIRouter()

UPLOAD_DIR = get_root_folder() / "models"
METADATA_FILE = get_root_folder() / "models" / "models.json"
ALLOWED_MODEL_EXTENSIONS = {".glb", ".gltf"}
os.makedirs(UPLOAD_DIR, exist_ok=True)

def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return []
    with open(METADATA_FILE, "r") as f:
        return json.load(f)

def save_metadata(data):
    with open(METADATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def is_valid_file(filename: str):
    return any(filename.lower().endswith(ext) for ext in ALLOWED_MODEL_EXTENSIONS)

@router.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    if not is_valid_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type")

    model_id = str(uuid.uuid4())
    extension = os.path.splitext(file.filename)[1]
    file_name = f"{model_id}{extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    metadata = load_metadata()
    record = {
        "model_id": model_id,
        "original_filename": file.filename,
        "stored_filename": file_name,
        "type": "" # user can configure this later
    }
    metadata.append(record)
    save_metadata(metadata)

    return record

@router.get("/models")
def list_models():
    return load_metadata()

@router.get("/vehicle-types")
def list_vehicle_types(request: Request):
    """Return mapping from configured vehicle type names to model file URLs."""
    metadata = load_metadata()
    base_url = str(request.base_url).rstrip("/")

    mapping = {}
    for record in metadata:
        vehicle_type = str(record.get("type", "")).strip()
        stored_filename = record.get("stored_filename")
        if not vehicle_type or not stored_filename:
            continue

        mapping[vehicle_type] = f"{base_url}/model-files/{stored_filename}"

    return mapping
