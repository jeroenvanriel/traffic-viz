from fastapi import APIRouter
import xml.etree.ElementTree as ET
import numpy as np
import pygeoops
from shapely.geometry import LineString, Polygon, MultiPolygon, MultiLineString, GeometryCollection
from shapely.ops import unary_union, substring
from shapely.strtree import STRtree
from app.util import get_root_folder
from app.cache import compute_cache_key, load_cache, save_cache
from app.serialization import serialize_polygons


DEFAULT_LANE_WIDTH = 3.2
EDGE_BORDER_WIDTH = 0.25
LANE_BORDER_WIDTH = 0.2
LANE_DASH_LENGTH = 3.0
LANE_GAP_LENGTH = 3.0
# Configuration of opposite-direction seam detection and marking
SEAM_DETECTION_EPSILON = 0.2  # Tolerance for robust boundary detection
MIN_SEAM_LENGTH = 0.5  # Minimum shared seam length to create marking
OPPOSITE_SEAM_STYLE = "dashed"  # "solid" for continuous, "dashed" for dashed


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


def iter_polygons(geometry):
    if isinstance(geometry, Polygon):
        if not geometry.is_empty:
            yield geometry
    elif isinstance(geometry, MultiPolygon):
        for poly in geometry.geoms:
            if not poly.is_empty:
                yield poly
    elif isinstance(geometry, GeometryCollection):
        for geom in geometry.geoms:
            yield from iter_polygons(geom)


def sample_tangent_at_distance(line: LineString, distance: float) -> np.ndarray | None:
    """Sample the tangent direction at a given distance along a line."""
    if line.length <= 1e-6:
        return None
    
    # Clamp distance to line bounds
    distance = max(0.0, min(distance, line.length))
    
    # Get nearby points to compute tangent
    delta = min(0.1, line.length * 0.1)
    d_back = max(0.0, distance - delta)
    d_forward = min(line.length, distance + delta)
    
    p_back = line.interpolate(d_back)
    p_forward = line.interpolate(d_forward)
    
    if p_back.distance(p_forward) < 1e-6:
        return None
    
    tangent = np.array([p_forward.x - p_back.x, p_forward.y - p_back.y])
    norm = np.linalg.norm(tangent)
    if norm < 1e-6:
        return None
    
    return tangent / norm


def seams_have_opposite_direction(centerline_a: LineString, centerline_b: LineString, seam: LineString) -> bool:
    """Check if two lane centerlines have opposite directions at the seam location."""
    if seam.length < 1e-6:
        return False
    
    # Sample midpoint of seam
    seam_mid = seam.interpolate(seam.length / 2)
    
    # Find closest point on centerline_a and sample tangent
    dist_a = centerline_a.project(seam_mid)
    tangent_a = sample_tangent_at_distance(centerline_a, dist_a)
    
    # Find closest point on centerline_b and sample tangent
    dist_b = centerline_b.project(seam_mid)
    tangent_b = sample_tangent_at_distance(centerline_b, dist_b)
    
    if tangent_a is None or tangent_b is None:
        return False
    
    # Check if tangents point in opposite directions (dot product < -0.7)
    dot = np.dot(tangent_a, tangent_b)
    return dot < -0.7


def robust_shared_boundary(poly_a: Polygon, poly_b: Polygon, eps: float) -> list[LineString]:
    """Extract shared seam centerlines between two polygons using robust overlap + pygeoops centerline."""
    shared_seams = []
    
    try:
        # Create buffered bands around boundaries
        band_a = poly_a.boundary.buffer(eps, cap_style=2, join_style=2)
        band_b = poly_b.boundary.buffer(eps, cap_style=2, join_style=2)
        
        # Compute overlap of buffered bands
        overlap = band_a.intersection(band_b)
        
        if overlap.is_empty:
            return []
        
        # Extract centerline(s) of overlap polygon(s), which approximates the actual seam.
        for overlap_poly in iter_polygons(overlap):
            if overlap_poly.area <= eps * eps:
                continue

            overlap_poly = overlap_poly.simplify(eps / 2, preserve_topology=True)

            centerline_geom = pygeoops.centerline(
                overlap_poly,
                densify_distance=max(eps, 0.25),
                # min_branch_length=MIN_SEAM_LENGTH,
                # simplifytolerance=eps / 2,
            )

            for seam in iter_lines(centerline_geom):
                if seam.length >= MIN_SEAM_LENGTH:
                    shared_seams.append(seam)
        
        # Fallback to raw intersection if centerline extraction returns nothing.
        if not shared_seams:
            raw_intersection = poly_a.boundary.intersection(poly_b.boundary)
            for line in iter_lines(raw_intersection):
                if line.length >= MIN_SEAM_LENGTH:
                    shared_seams.append(line)
    except Exception:
        pass
    
    return shared_seams


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


def build_lane_records(root):
    """Build detailed lane records with geometry and metadata."""
    records = []
    
    for edge in root.findall("edge"):
        if edge.get("function") == "internal":
            continue
        
        edge_id = edge.get("id")
        lanes = edge.findall("lane")
        lanes = sorted(lanes, key=lambda l: int(l.get("index", 0)))
        
        for ix, lane in enumerate(lanes):
            shape_str = lane.get("shape")
            if not shape_str:
                continue
            
            points = parse_sumo_coords(shape_str)
            if len(points) < 2:
                continue
            
            centerline = LineString(points)
            width = float(lane.get("width", DEFAULT_LANE_WIDTH))
            poly = centerline.buffer(width / 2, cap_style=2, join_style=2)
            
            if not poly.is_empty:
                records.append({
                    "edge_id": edge_id,
                    "lane_index": ix,
                    "centerline": centerline,
                    "polygon": poly,
                    "width": width,
                })
    
    return records


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


def compute_opposite_direction_borders(lane_records):
    """Compute marking polygons for seams between opposite-direction lanes."""
    borders = []
    if len(lane_records) < 2:
        return [], []
    
    # Build spatial index on lane polygons
    polys = [rec["polygon"] for rec in lane_records]
    tree = STRtree(polys)
    
    # Track processed pairs to avoid duplicates
    processed = set()
    
    for i, rec_a in enumerate(lane_records):
        poly_a = rec_a["polygon"]
        
        # Find candidate neighbors via spatial index
        candidates = tree.query(poly_a.envelope.buffer(SEAM_DETECTION_EPSILON * 2))
        
        for j in candidates:
            if i >= j or (i, j) in processed:
                continue
            
            processed.add((i, j))
            
            rec_b = lane_records[j]
            poly_b = rec_b["polygon"]
            
            # Skip same-edge pairs (handled by compute_lane_borders)
            if rec_a["edge_id"] == rec_b["edge_id"]:
                continue
            
            # Find robust shared seams
            seams = robust_shared_boundary(poly_a, poly_b, SEAM_DETECTION_EPSILON)
            
            for seam in seams:
                # Check if opposite direction
                if seams_have_opposite_direction(rec_a["centerline"], rec_b["centerline"], seam):
                    # Convert seam to solid polygon marking
                    if OPPOSITE_SEAM_STYLE == "solid":
                        marking_poly = seam.buffer(LANE_BORDER_WIDTH / 2, cap_style=2, join_style=2)
                        if not marking_poly.is_empty:
                            borders.append(marking_poly)
                    elif OPPOSITE_SEAM_STYLE == "dashed":
                        dashes = dashed_line_to_polygons(
                            seam,
                            dash_length=LANE_DASH_LENGTH,
                            gap_length=LANE_GAP_LENGTH,
                            width=LANE_BORDER_WIDTH,
                        )
                        borders.extend(dashes)
    
    return borders


def compute_bounds(polygons):
    minx, miny, maxx, maxy = MultiPolygon(polygons).bounds
    pad = 10 # extra padding for the bounds
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
        lane_records = build_lane_records(root)
        opposite_borders = compute_opposite_direction_borders(lane_records)
        borders = serialize_polygons(edge_borders + lane_borders + opposite_borders)

        save_cache(scene_id, "polygons", cache_key, polygons)
        save_cache(scene_id, "bounds", cache_key, bounds)
        save_cache(scene_id, "borders", cache_key, borders)

    return {
        "polygons": polygons,
        "borders": borders,
        "bounds": bounds,
    }
