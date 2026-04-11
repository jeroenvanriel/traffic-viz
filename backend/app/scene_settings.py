from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.util import get_root_folder

router = APIRouter(prefix="/scenes/{scene_id}/settings")

SCENES_DIR = get_root_folder() / "scenes"


class Vec3Payload(BaseModel):
    x: float
    y: float
    z: float


class InitialCameraStatePayload(BaseModel):
    position: Vec3Payload
    target: Vec3Payload


class SceneSettingsPayload(BaseModel):
    initCameraState: Optional[InitialCameraStatePayload] = None


def _default_scene_settings() -> SceneSettingsPayload:
    return SceneSettingsPayload(initCameraState=None)


def _get_scene_dir(scene_id: str) -> Path:
    scene_dir = SCENES_DIR / scene_id
    if not scene_dir.exists() or not scene_dir.is_dir():
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene_dir


def _get_settings_path(scene_id: str) -> Path:
    scene_dir = _get_scene_dir(scene_id)
    return scene_dir / "scene_settings.json"


@router.get("")
def get_scene_settings(scene_id: str):
    settings_path = _get_settings_path(scene_id)

    if not settings_path.exists():
        return _default_scene_settings().model_dump()

    try:
        settings = SceneSettingsPayload.model_validate_json(settings_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Invalid scene settings file") from exc

    return settings.model_dump()


@router.put("")
def upsert_scene_settings(scene_id: str, payload: SceneSettingsPayload):
    settings_path = _get_settings_path(scene_id)
    settings_path.write_text(payload.model_dump_json(indent=2), encoding="utf-8")
    return {"saved": True}
