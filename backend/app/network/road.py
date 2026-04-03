from shapely.geometry import LineString, Polygon, MultiPolygon
from shapely.ops import unary_union
from .util import dashed_line_to_polygons, parse_sumo_coords, iter_lines

DEFAULT_LANE_WIDTH = 3.2
EDGE_MARKING_WIDTH = 0.25
LANE_MARKING_WIDTH = 0.2


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


def get_junction_polygons(root):
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


def compute_lane_markings(lane_records):
    markings = []
    for record in lane_records:
        centerline = record["centerline"]
        width = record["width"]

        # compute the marking line for this lane by offsetting 
        # the centerline to the left by half the lane width
        marking = centerline.parallel_offset(
            -width / 2,
            side="left",
            join_style=2  # mitre joins
        )

        if marking.is_empty:
            continue

        for marking_line in iter_lines(marking):
            markings.extend(
                dashed_line_to_polygons(
                    marking_line,
                    width=LANE_MARKING_WIDTH,
                )
            )

    return markings


def compute_edge_markings(road_polygons, union_buffer=0.1):
    # compute union of all polygons (lanes + junctions) and
    # buffer slightly to account for nearly-touching polygons
    union = unary_union(road_polygons).buffer(union_buffer)
    markings = []

    # create true-width edge marking by buffering the network boundary curves.
    for boundary_line in iter_lines(union.boundary):
        marking_poly = boundary_line.buffer(EDGE_MARKING_WIDTH / 2, cap_style=2, join_style=2)
        if not marking_poly.is_empty:
            markings.append(marking_poly)

    return markings


def compute_bounds(polygons):
    minx, miny, maxx, maxy = MultiPolygon(polygons).bounds
    pad = 10 # extra padding for the bounds
    return dict(minx=minx - pad, miny=miny - pad, maxx=maxx + pad, maxy=maxy + pad)

