from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
import uuid
from app.util import get_root_folder
import os
import json
import time
from datetime import datetime, timezone

router = APIRouter()

UPLOAD_DIR = get_root_folder() / "models"
os.makedirs(UPLOAD_DIR, exist_ok=True)
THUMBNAIL_DIR = get_root_folder() / "models" / "thumbnails"
os.makedirs(THUMBNAIL_DIR, exist_ok=True)
METADATA_FILE = get_root_folder() / "models" / "models.json"
ALLOWED_MODEL_EXTENSIONS = {".glb", ".gltf"}
ALLOWED_THUMBNAIL_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_TRANSFORM_CONFIG = {
    "scale": [1.0, 1.0, 1.0],
    "rotation": [0.0, 0.0, 0.0],
    "offset": [0.0, 0.0, 0.0],
}

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
        "added_at": datetime.now(timezone.utc).isoformat(),
        # user can configure the following fields later
        "type": "", 
        "transform_config": dict(DEFAULT_TRANSFORM_CONFIG),
        "thumbnail_filename": None,
    }
    metadata.append(record)
    save_metadata(metadata)

    return record

@router.get("/models")
def list_models(request: Request):
    base_url = str(request.base_url).rstrip("/")
    return [with_thumbnail_url(record, base_url) for record in load_metadata()]

class TransformConfigPayload(BaseModel):
    scale: list[float] | None = None
    rotation: list[float] | None = None
    offset: list[float] | None = None

class ModelUpdatePayload(BaseModel):
    type: str | None = None
    transform_config: TransformConfigPayload | None = None

class ModelTypeUpdatePayload(BaseModel):
    type: str

@router.post("/models/{model_id}/thumbnail")
async def upload_model_thumbnail(model_id: str, request: Request, file: UploadFile = File(...)):
    filename = file.filename or "thumbnail.png"
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_THUMBNAIL_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid thumbnail file type")

    metadata = load_metadata()
    for index, record in enumerate(metadata):
        if record.get("model_id") != model_id:
            continue

        thumbnail_filename = f"{model_id}{extension}"
        thumbnail_path = THUMBNAIL_DIR / thumbnail_filename
        data = await file.read()
        with open(thumbnail_path, "wb") as out:
            out.write(data)

        previous_thumbnail = record.get("thumbnail_filename")
        if previous_thumbnail and previous_thumbnail != thumbnail_filename:
            previous_path = THUMBNAIL_DIR / previous_thumbnail
            if previous_path.exists():
                previous_path.unlink() # remove old thumbnail file

        record["thumbnail_filename"] = thumbnail_filename

        metadata[index] = record
        save_metadata(metadata)

        base_url = str(request.base_url).rstrip("/")
        return with_thumbnail_url(record, base_url)

    raise HTTPException(status_code=404, detail="Model not found")

def _normalize_vec3(value, fallback):
    if isinstance(value, list) and len(value) == 3:
        try:
            return [float(value[0]), float(value[1]), float(value[2])]
        except (TypeError, ValueError):
            return list(fallback)
    return list(fallback)

def normalize_transform_config(config):
    config = config or {}
    return {
        "scale": _normalize_vec3(config.get("scale"), DEFAULT_TRANSFORM_CONFIG["scale"]),
        "rotation": _normalize_vec3(config.get("rotation"), DEFAULT_TRANSFORM_CONFIG["rotation"]),
        "offset": _normalize_vec3(config.get("offset"), DEFAULT_TRANSFORM_CONFIG["offset"]),
    }

def with_thumbnail_url(record, base_url: str):
    data = dict(record)
    thumbnail_filename = data.get("thumbnail_filename")
    if thumbnail_filename:
        data["thumbnail_url"] = f"{base_url}/model-thumbnails/{thumbnail_filename}"
    else:
        data["thumbnail_url"] = None
    return data

@router.patch("/models/{model_id}")
def update_model(model_id: str, payload: ModelUpdatePayload, request: Request):
    metadata = load_metadata()

    # Just a simple linear search since we don't expect a large number of models;
    # this keeps it straightforward without needing additional indexing structures.
    for index, record in enumerate(metadata):
        if record.get("model_id") != model_id:
            continue

        if payload.type is not None:
            record["type"] = payload.type.strip()

        if payload.transform_config is not None:
            patch_config = payload.transform_config.model_dump(exclude_none=True)
            merged_config = record["transform_config"]
            merged_config.update(patch_config)
            record["transform_config"] = normalize_transform_config(merged_config)

        metadata[index] = record
        save_metadata(metadata)
        base_url = str(request.base_url).rstrip("/")
        return with_thumbnail_url(record, base_url)

    raise HTTPException(status_code=404, detail="Model not found")

@router.patch("/models/{model_id}/type")
def update_model_type(model_id: str, payload: ModelTypeUpdatePayload, request: Request):
    metadata = load_metadata()

    for index, record in enumerate(metadata):
        if record.get("model_id") != model_id:
            continue

        record["type"] = payload.type.strip()
        metadata[index] = record
        save_metadata(metadata)

        base_url = str(request.base_url).rstrip("/")
        return with_thumbnail_url(record, base_url)

    raise HTTPException(status_code=404, detail="Model not found")

@router.delete("/models/{model_id}")
def delete_model(model_id: str):
    metadata = load_metadata()

    for index, record in enumerate(metadata):
        if record.get("model_id") != model_id:
            continue

        stored_filename = record.get("stored_filename")
        if stored_filename:
            model_path = UPLOAD_DIR / stored_filename
            if model_path.exists():
                model_path.unlink()

        thumbnail_filename = record.get("thumbnail_filename")
        if thumbnail_filename:
            thumbnail_path = THUMBNAIL_DIR / thumbnail_filename
            if thumbnail_path.exists():
                thumbnail_path.unlink()

        del metadata[index]
        save_metadata(metadata)
        return {"deleted": model_id}

    raise HTTPException(status_code=404, detail="Model not found")

@router.get("/vehicle-types")
def list_vehicle_types(request: Request):
    """Return mapping from configured vehicle type names to model file data."""
    metadata = load_metadata()
    base_url = str(request.base_url).rstrip("/")

    mapping = {}
    for record in metadata:
        vehicle_type = record["type"].strip()
        stored_filename = record["stored_filename"]
        if not vehicle_type or not stored_filename:
            continue

        mapping[vehicle_type] = {
            "url": f"{base_url}/model-files/{stored_filename}",
            "transform_config": record["transform_config"],
        }

    return mapping
