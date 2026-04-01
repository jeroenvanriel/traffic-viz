from fastapi import APIRouter
import xml.etree.ElementTree as ET
from shapely.geometry import LineString, Polygon, MultiPolygon, MultiLineString
from shapely.ops import unary_union, substring
from app.util import get_root_folder
from app.cache import compute_cache_key, load_cache, save_cache
from app.serialization import serialize_polygons


DEFAULT_LANE_WIDTH = 3.2
EDGE_BORDER_WIDTH = 0.25
LANE_BORDER_WIDTH = 0.18
LANE_DASH_LENGTH = 3.0
LANE_GAP_LENGTH = 3.0


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
            if len(points) <= 1:
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


def iter_lines(geometry):
    if isinstance(geometry, LineString):
        if not geometry.is_empty:
            yield geometry
    elif isinstance(geometry, MultiLineString):
        for line in geometry.geoms:
            if not line.is_empty:
                yield line


def dashed_line_to_polygons(
    line: LineString,
    dash_length: float,
    gap_length: float,
    width: float,
):
    dashes = []
    if line.is_empty or line.length <= 1e-6:
        return dashes

    position = 0.0
    while position < line.length:
        dash_end = min(position + dash_length, line.length)
        dash_geom = substring(line, position, dash_end)

        for dash in iter_lines(dash_geom):
            if dash.length <= 1e-6:
                continue
            dash_poly = dash.buffer(width / 2, cap_style=2, join_style=2)
            if not dash_poly.is_empty:
                dashes.append(dash_poly)

        position += dash_length + gap_length

    return dashes


def compute_lane_borders(root):
    borders = []
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

            if ix == len(lanes) - 1:
                continue # skip leftmost lane
            border = offset_line(line, -width / 2)
            if border.is_empty:
                continue

            for border_line in iter_lines(border):
                borders.extend(
                    dashed_line_to_polygons(
                        border_line,
                        dash_length=LANE_DASH_LENGTH,
                        gap_length=LANE_GAP_LENGTH,
                        width=LANE_BORDER_WIDTH,
                    )
                )

    return borders


def compute_edge_borders(polygons, union_buffer=0.1):
    # compute union of all polygons
    # buffer() slightly to fix nearly-touching polygons that should
    # share a border but don't due to small gaps
    union = unary_union(polygons).buffer(union_buffer)
    borders = []

    # Create true-width edge borders by buffering the network boundary curves.
    for boundary_line in iter_lines(union.boundary):
        border_poly = boundary_line.buffer(EDGE_BORDER_WIDTH / 2, cap_style=2, join_style=2)
        if not border_poly.is_empty:
            borders.append(border_poly)

    return borders


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
    borders = load_cache(scene_id, "borders", cache_key)
    if polygons is None or bounds is None or borders is None or True: # TODO: remove "or True" to enable caching
        lane_polys = build_lane_polygons(root)
        junction_polys = build_junction_polygons(root)
        all_polys = lane_polys + junction_polys
        polygons = serialize_polygons(all_polys)
        bounds = compute_bounds(all_polys)

        lane_borders = compute_lane_borders(root)
        edge_borders = compute_edge_borders(all_polys)
        borders = serialize_polygons(edge_borders + lane_borders)

        save_cache(scene_id, "polygons", cache_key, polygons)
        save_cache(scene_id, "bounds", cache_key, bounds)
        save_cache(scene_id, "borders", cache_key, borders)

    return {
        "polygons": polygons,
        "borders": borders,
        "bounds": bounds,
    }
