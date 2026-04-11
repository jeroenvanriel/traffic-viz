import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.util import resource_path, get_root_folder, open_browser_later
import os

# frontend files
frontend_dir = resource_path("frontend/dist")
index_file = frontend_dir / "index.html"

SCENES_DIR = get_root_folder() / "scenes"
os.makedirs(SCENES_DIR, exist_ok=True)

app = FastAPI()

# allow frontend access
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

# scene names listing
@app.get("/api/scenes")
async def list_scenes(request: Request):
    folders = sorted(p.name for p in SCENES_DIR.iterdir() if p.is_dir())
    base_url = str(request.base_url).rstrip("/")
    scenes = [
        {
            "scene_id": scene_id,
            "thumbnail_url": f"{base_url}/api/scenes/{scene_id}/thumbnail",
        }
        for scene_id in folders
    ]
    return {"scenes": scenes}

# import routers
import app.model as model
import app.network.api as network
import app.fcd as fcd
import app.camera_sequences as camera_sequences
import app.scene_settings as scene_settings
import app.scene_thumbnail as scene_thumbnail
app.include_router(model.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(fcd.router, prefix="/api")
app.include_router(camera_sequences.router, prefix="/api")
app.include_router(scene_settings.router, prefix="/api")
app.include_router(scene_thumbnail.router, prefix="/api")

# static frontend assets
app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

# 3d model assets
from app.model import UPLOAD_DIR, THUMBNAIL_DIR
app.mount("/model-files", StaticFiles(directory=UPLOAD_DIR), name="model-files")
app.mount("/model-thumbnails", StaticFiles(directory=THUMBNAIL_DIR), name="model-thumbnails")

# catch-all route for SPA routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str, request: Request):
    # ignore api routes and static assets
    if request.url.path.startswith("/api") or request.url.path.startswith("/assets"):
        return {"detail": "Not Found"}, 404
    # otherwise, serve SPA entry
    return FileResponse(index_file)

if __name__ == "__main__":
    # open frontend url in browser (after slight delay)
    open_browser_later("http://localhost:8000")

    # start backend server
    uvicorn.run(app, host="localhost", port=8000, log_level="info")
