from fastapi import APIRouter
import xml.etree.ElementTree as ET
from app.util import get_root_folder
from app.cache import compute_cache_key, load_cache, save_cache
from .serialization import serialize_layer
from .road import build_lane_records, build_junction_records, compute_bounds, compute_lane_markings, compute_edge_markings
from .parallel_marking import compute_parallel_direction_markings


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
    lanes_layer = load_cache(scene_id, "lanes", cache_key)
    junctions_layer = load_cache(scene_id, "junctions", cache_key)
    bounds = load_cache(scene_id, "bounds", cache_key)
    lane_markings_layer = load_cache(scene_id, "lane_markings", cache_key)
    edge_markings_layer = load_cache(scene_id, "edge_markings", cache_key)
    parallel_markings_layer = load_cache(scene_id, "parallel_markings", cache_key)
    band_a_layer = load_cache(scene_id, "parallel_band_a", cache_key)
    band_b_layer = load_cache(scene_id, "parallel_band_b", cache_key)
    overlap_layer = load_cache(scene_id, "parallel_overlap", cache_key)
    if (
        lanes_layer is None
        or junctions_layer is None
        or bounds is None
        or lane_markings_layer is None
        or edge_markings_layer is None
        or parallel_markings_layer is None
        or band_a_layer is None
        or band_b_layer is None
        or overlap_layer is None
        or True # TODO: remove this to enable caching
    ):
        # Construct lane and junction records
        lane_records = build_lane_records(root)
        junction_records = build_junction_records(root)

        # Collect the road polygons
        lane_polys = [rec["polygon"] for rec in lane_records]
        junc_polys = [rec["polygon"] for rec in junction_records]
        
        # Compute bounds for viewport fitting
        bounds = compute_bounds(lane_polys + junc_polys)

        # Compute lane markings
        lane_markings = compute_lane_markings(lane_records)
        edge_markings = compute_edge_markings(lane_polys + junc_polys)
        parallel_markings, parallel_marking_debug = compute_parallel_direction_markings(lane_records)

        # Serialize and cache layers
        lanes_layer = serialize_layer("Lanes", lane_records, metadata_fields=["edge_id", "lane_index"])
        junctions_layer = serialize_layer("Junctions", junction_records, metadata_fields=["id"])
        lane_markings_layer = serialize_layer("Lane Markings", lane_markings)
        edge_markings_layer = serialize_layer("Edge Markings", edge_markings)
        parallel_markings_layer = serialize_layer("Separating Centerlines", parallel_markings)
        band_a_layer = serialize_layer("Band A", parallel_marking_debug["band_a"], metadata_fields=["edge_id", "lane_index", "i"])
        band_b_layer = serialize_layer("Band B", parallel_marking_debug["band_b"], metadata_fields=["edge_id", "lane_index", "j"])
        overlap_layer = serialize_layer("Overlap", parallel_marking_debug["overlap"], metadata_fields=["edge_id", "lane_index"])

        save_cache(scene_id, "lanes", cache_key, lanes_layer)
        save_cache(scene_id, "junctions", cache_key, junctions_layer)
        save_cache(scene_id, "lane_markings", cache_key, lane_markings_layer)
        save_cache(scene_id, "edge_markings", cache_key, edge_markings_layer)
        save_cache(scene_id, "parallel_markings", cache_key, parallel_markings_layer)
        save_cache(scene_id, "parallel_band_a", cache_key, band_a_layer)
        save_cache(scene_id, "parallel_band_b", cache_key, band_b_layer)
        save_cache(scene_id, "parallel_overlap", cache_key, overlap_layer)
        save_cache(scene_id, "bounds", cache_key, bounds)

    return {
        "layers": {
            "lanes": lanes_layer,
            "junctions": junctions_layer,
            "lane_markings": lane_markings_layer,
            "edge_markings": edge_markings_layer,
            "parallel_markings": parallel_markings_layer,
        },
        "debug_layers": {
            "parallel_band_a": band_a_layer,
            "parallel_band_b": band_b_layer,
            "parallel_overlap": overlap_layer,
        },
        "bounds": bounds,
    }
