from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uuid
from app.util import get_root_folder
import os

router = APIRouter()

UPLOAD_DIR = get_root_folder() / "models"
ALLOWED_MODEL_EXTENSIONS = {".glb", ".gltf"}
os.makedirs(UPLOAD_DIR, exist_ok=True)

def is_valid_file(filename: str):
    return any(filename.lower().endswith(ext) for ext in ALLOWED_MODEL_EXTENSIONS)

@router.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    if not is_valid_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type")

    model_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{model_id}{file_extension}")

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return JSONResponse({
        "model_id": model_id,
        "filename": file.filename,
        "url": f"/models/{model_id}{file_extension}"
    })

from fastapi.staticfiles import StaticFiles

router.mount("/models", StaticFiles(directory=UPLOAD_DIR), name="models")
