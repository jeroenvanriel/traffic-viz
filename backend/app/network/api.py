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
    road_layer = load_cache(scene_id, "road", cache_key)
    bounds = load_cache(scene_id, "bounds", cache_key)
    edge_markings_layer = load_cache(scene_id, "edge_markings", cache_key)
    opposite_markings_layer = load_cache(scene_id, "opposite_markings", cache_key)
    if (
        road_layer is None
        or bounds is None
        or edge_markings_layer is None
        or opposite_markings_layer is None
    ):
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
        road_layer = serialize_polygons(all_polys)
        edge_markings_layer = serialize_polygons(edge_markings + lane_markings)
        opposite_markings_layer = serialize_polygons(opposite_markings)
        save_cache(scene_id, "road", cache_key, road_layer)
        save_cache(scene_id, "edge_markings", cache_key, edge_markings_layer)
        save_cache(scene_id, "opposite_markings", cache_key, opposite_markings_layer)
        save_cache(scene_id, "bounds", cache_key, bounds)

    return {
        "layers": {
            "road": {
                "kind": "polygon",
                "polygons": road_layer,
            },
            "edge_markings": {
                "kind": "polygon",
                "polygons": edge_markings_layer,
            },
            "opposite_markings": {
                "kind": "polygon",
                "polygons": opposite_markings_layer,
            },
        },
        "bounds": bounds,
    }
