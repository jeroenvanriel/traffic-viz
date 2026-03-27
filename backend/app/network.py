from fastapi import APIRouter
import xml.etree.ElementTree as ET
from shapely.geometry import LineString, Polygon, MultiPolygon
from app.util import get_root_folder
from app.cache import compute_cache_key, load_cache, save_cache
from app.serialization import serialize_lines, serialize_polygons

DEFAULT_LANE_WIDTH = 3.2


def load_sumo_network(scene_id: str):
    road_file = get_root_folder() / "scenes" / scene_id / "road.net.xml"
    tree = ET.parse(road_file)
    return tree.getroot(), road_file


def parse_sumo_coords(shape_str):
    points = [tuple(map(float, p.split(","))) for p in shape_str.split()]
    return [(x, -y) for (x, y) in points]


def build_lane_polygons(root):
    polygons = []

    for edge in root.findall("edge"):
        if edge.get("function") == "internal":
            continue

        for lane in edge.findall("lane"):
            shape_str = lane.get("shape")
            if not shape_str:
                continue

            points = parse_sumo_coords(shape_str)
            if not points:
                continue

            line = LineString(points)
            width = float(lane.get("width", DEFAULT_LANE_WIDTH))

            poly = line.buffer(width / 2, cap_style=2, join_style=2)
            if not poly.is_empty:
                polygons.append(poly)

    return polygons


def build_junction_polygons(root):
    polygons = []

    for junction in root.findall("junction"):
        shape_str = junction.get("shape")
        if not shape_str:
            continue

        points = parse_sumo_coords(shape_str)
        if len(points) <= 2:
            continue

        polygons.append(Polygon(points))

    return polygons


def offset_line(line: LineString, distance: float):
    return line.parallel_offset(
        distance,
        side="left",
        join_style=2  # mitre joins
    )


def compute_seams(root):
    seams = []
    for edge in root.findall("edge"):
        if edge.get("function") == "internal":
            continue

        lanes = edge.findall("lane")

        # sort lanes by index (important!)
        lanes = sorted(lanes, key=lambda l: int(l.get("index", 0)))

        for ix, lane in enumerate(lanes):
            shape_str = lane.get("shape")
            if not shape_str:
                continue

            points = parse_sumo_coords(shape_str)
            if len(points) < 2:
                continue

            line = LineString(points)
            width = float(lane.get("width", DEFAULT_LANE_WIDTH))

            if ix == 0:
                # leftmost lane: offset to the left
                seam = offset_line(line, width / 2)
                if not seam.is_empty:
                    seams.append(seam)
            seam = offset_line(line, -width / 2)
            if not seam.is_empty:
                seams.append(seam)

    return seams


def compute_bounds(polygons):
    minx, miny, maxx, maxy = MultiPolygon(polygons).bounds
    pad = 10 # extra padding for the bounds
    print(minx, miny, maxx, maxy)
    return dict(minx=minx - pad, miny=miny - pad, maxx=maxx + pad, maxy=maxy + pad)


router = APIRouter(prefix="/scenes/{scene_id}")

@router.get("/road")
async def get_road_network(scene_id: str):
    root, road_file = load_sumo_network(scene_id)
    cache_key = compute_cache_key(road_file)

    # --- Load or compute polygons ---
    polygons = load_cache(scene_id, "polygons", cache_key)
    bounds = load_cache(scene_id, "bounds", cache_key)
    seams = load_cache(scene_id, "seams", cache_key)
    if polygons is None or bounds is None or seams is None:
        lane_polys = build_lane_polygons(root)
        junction_polys = build_junction_polygons(root)
        all_polys = lane_polys + junction_polys
        polygons = serialize_polygons(all_polys)
        bounds = compute_bounds(all_polys)
        seams = serialize_lines(compute_seams(root))
        save_cache(scene_id, "polygons", cache_key, polygons)
        save_cache(scene_id, "bounds", cache_key, bounds)
        save_cache(scene_id, "seams", cache_key, seams)

    return {
        "polygons": polygons,
        "seams": seams,
        "bounds": bounds,
    }
