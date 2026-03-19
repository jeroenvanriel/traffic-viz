from fastapi import APIRouter, UploadFile, File, HTTPException
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
        "stored_filename": file_name
    }
    metadata.append(record)
    save_metadata(metadata)

    return record

@router.get("/models")
def list_models():
    return load_metadata()

from fastapi.staticfiles import StaticFiles

router.mount("/models", StaticFiles(directory=UPLOAD_DIR), name="models")
