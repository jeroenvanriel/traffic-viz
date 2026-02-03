from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import SCENES_DIR

app = FastAPI()

# allow frontend access
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

# scene names listing
@app.get("/scenes")
async def list_scenes():
    folders = [p.name for p in SCENES_DIR.iterdir() if p.is_dir()]
    return {"scenes": folders}

# import routers
from . import network, fcd
app.include_router(network.router)
app.include_router(fcd.router)
