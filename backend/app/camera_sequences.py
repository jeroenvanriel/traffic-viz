from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.util import get_root_folder

router = APIRouter(prefix="/scenes/{scene_id}/camera/sequences")

SCENES_DIR = get_root_folder() / "scenes"

class Vec3Payload(BaseModel):
    x: float
    y: float
    z: float

class CameraKeyframePayload(BaseModel):
    id: str
    position: Vec3Payload
    target: Vec3Payload
    step: int

class CameraSequencePayload(BaseModel):
    id: str
    name: str
    keyframes: list[CameraKeyframePayload]


def _get_sequence_dir(scene_id: str) -> Path:
    scene_dir = SCENES_DIR / scene_id
    if not scene_dir.exists() or not scene_dir.is_dir():
        raise HTTPException(status_code=404, detail="Scene not found")

    sequence_dir = scene_dir / "camera_sequences"
    sequence_dir.mkdir(parents=True, exist_ok=True)
    return sequence_dir


def _safe_sequence_path(scene_id: str, sequence_id: str) -> Path:
    if not sequence_id or "/" in sequence_id or "\\" in sequence_id:
        raise HTTPException(status_code=400, detail="Invalid sequence id")

    sequence_dir = _get_sequence_dir(scene_id)
    return sequence_dir / f"{sequence_id}.json"


@router.get("")
def list_sequences(scene_id: str):
    sequence_dir = _get_sequence_dir(scene_id)

    sequences: list[dict] = []
    for path in sorted(sequence_dir.glob("*.json")):
        try:
            payload = CameraSequencePayload.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception:
            # Ignore malformed files so one bad file does not break all loading.
            continue
        sequences.append(payload.model_dump())

    return {"sequences": sequences}


@router.put("/{sequence_id}")
def upsert_sequence(scene_id: str, sequence_id: str, payload: CameraSequencePayload):
    if payload.id != sequence_id:
        raise HTTPException(status_code=400, detail="Payload id must match sequence id")

    path = _safe_sequence_path(scene_id, sequence_id)
    path.write_text(payload.model_dump_json(indent=2), encoding="utf-8")
    return {"saved": sequence_id}


@router.delete("/{sequence_id}")
def delete_sequence(scene_id: str, sequence_id: str):
    path = _safe_sequence_path(scene_id, sequence_id)
    if path.exists():
        path.unlink()
    return {"deleted": sequence_id}
