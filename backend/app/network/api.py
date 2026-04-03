from fastapi import APIRouter
from app.util import get_root_folder
import xml.etree.ElementTree as ET
from app.cache import compute_cache_key, load_cache, save_cache
from .serialization import serialize_polygons
from .road import build_lane_records, get_junction_polygons, compute_bounds, compute_lane_markings, compute_edge_markings
from .opposite_marking import compute_opposite_direction_markings


def load_sumo_network(scene_id: str):
    road_file = get_root_folder() / "scenes" / scene_id / "road.net.xml"
    tree = ET.parse(road_file)
    return tree.getroot(), road_file


router = APIRouter(prefix="/scenes/{scene_id}")

@router.get("/road")
async def get_road_network(scene_id: str):
    root, road_file = load_sumo_network(scene_id)
    cache_key = compute_cache_key(road_file)

    # --- Inspect cache ---
    polygons = load_cache(scene_id, "polygons", cache_key)
    bounds = load_cache(scene_id, "bounds", cache_key)
    markings = load_cache(scene_id, "markings", cache_key)
    if polygons is None or bounds is None or markings is None or True: # TODO: remove "or True" to enable caching
        # --- Construct lane records ---
        # (containing geometry and metadata for reuse in opposite markings computation)
        lane_records = build_lane_records(root)

        # --- Compute the road polygons ---
        lane_polys = [rec["polygon"] for rec in lane_records]
        junc_polys = get_junction_polygons(root)
        all_polys = lane_polys + junc_polys

        # --- Compute bounds for viewport fitting ---
        bounds = compute_bounds(all_polys)

        # --- Compute lane markings ---
        lane_markings = compute_lane_markings(lane_records)
        edge_markings = compute_edge_markings(all_polys)
        opposite_markings = compute_opposite_direction_markings(lane_records)

        # --- Serialize and cache results ---
        polygons = serialize_polygons(all_polys)
        markings = serialize_polygons(edge_markings + lane_markings + opposite_markings)
        save_cache(scene_id, "polygons", cache_key, polygons)
        save_cache(scene_id, "markings", cache_key, markings)
        save_cache(scene_id, "bounds", cache_key, bounds)

    return {
        "polygons": polygons,
        "markings": markings,
        "bounds": bounds,
    }
