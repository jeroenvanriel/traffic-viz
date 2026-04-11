from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, ImageDraw

from app.util import get_root_folder
from app.network.api import load_sumo_network
from app.network.road import build_lane_records, get_junction_polygons

router = APIRouter(prefix="/scenes/{scene_id}")

SCENES_DIR = get_root_folder() / "scenes"
THUMBNAIL_SIZE = 512
THUMBNAIL_PADDING = 24
THUMBNAIL_BACKGROUND = "#f3f4f6"
THUMBNAIL_ROAD_COLOR = "#555555"


def _get_scene_dir(scene_id: str) -> Path:
    scene_dir = SCENES_DIR / scene_id
    if not scene_dir.exists() or not scene_dir.is_dir():
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene_dir


def _get_thumbnail_path(scene_id: str) -> Path:
    return _get_scene_dir(scene_id) / "thumbnail.png"


def _iter_polygons(geom):
    if geom.geom_type == "Polygon":
        yield geom
        return
    if geom.geom_type == "MultiPolygon":
        for poly in geom.geoms:
            yield poly


def _render_thumbnail(scene_id: str, output_path: Path):
    try:
        root, _ = load_sumo_network(scene_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Scene road network not found") from exc

    lane_records = build_lane_records(root)
    lane_polys = [rec["polygon"] for rec in lane_records]
    junc_polys = get_junction_polygons(root)
    polygons = [poly for poly in lane_polys + junc_polys if not poly.is_empty]

    image = Image.new("RGB", (THUMBNAIL_SIZE, THUMBNAIL_SIZE), THUMBNAIL_BACKGROUND)
    draw = ImageDraw.Draw(image)

    if not polygons:
        image.save(output_path, format="PNG")
        return

    minx = min(poly.bounds[0] for poly in polygons)
    miny = min(poly.bounds[1] for poly in polygons)
    maxx = max(poly.bounds[2] for poly in polygons)
    maxy = max(poly.bounds[3] for poly in polygons)

    width = max(maxx - minx, 1e-6)
    height = max(maxy - miny, 1e-6)
    scale = min(
        (THUMBNAIL_SIZE - 2 * THUMBNAIL_PADDING) / width,
        (THUMBNAIL_SIZE - 2 * THUMBNAIL_PADDING) / height,
    )

    draw_width = width * scale
    draw_height = height * scale
    offset_x = (THUMBNAIL_SIZE - draw_width) / 2
    offset_y = (THUMBNAIL_SIZE - draw_height) / 2

    def project(x: float, y: float):
        px = offset_x + (x - minx) * scale
        py = offset_y + (maxy - y) * scale
        return (px, py)

    for geom in polygons:
        for poly in _iter_polygons(geom):
            exterior = [project(x, y) for x, y in poly.exterior.coords]
            if len(exterior) >= 3:
                draw.polygon(exterior, fill=THUMBNAIL_ROAD_COLOR)

            for ring in poly.interiors:
                hole = [project(x, y) for x, y in ring.coords]
                if len(hole) >= 3:
                    draw.polygon(hole, fill=THUMBNAIL_BACKGROUND)

    image.save(output_path, format="PNG")


def ensure_scene_thumbnail(scene_id: str) -> Path:
    output_path = _get_thumbnail_path(scene_id)
    if output_path.exists():
        return output_path

    _render_thumbnail(scene_id, output_path)
    return output_path


@router.get("/thumbnail")
def get_scene_thumbnail(scene_id: str):
    output_path = ensure_scene_thumbnail(scene_id)
    return FileResponse(output_path, media_type="image/png")
