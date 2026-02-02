from fastapi import APIRouter
import xml.etree.ElementTree as ET
from shapely.geometry import LineString
from shapely.ops import unary_union

router = APIRouter(prefix="/scenes/{scene_id}")

from .config import SCENES_DIR

@router.get("/road")
async def get_road_network(scene_id: str):
    road_file = SCENES_DIR / scene_id / "road.net.xml"
    tree = ET.parse(road_file)
    root = tree.getroot()

    merged_roads = []

    for edge in root.findall("edge"):
        lanes = edge.findall("lane")
        lane_shapes = []
        for lane in lanes:
            shape_str = lane.get("shape")
            width = float(lane.get("width", 3.0))
            points = [tuple(map(float, p.split(","))) for p in shape_str.split()]

            # NOTE: we need to flip y-coords (SUMO) in the bounds
            points = [(x, -y) for (x, y) in points]

            line = LineString(points)
            # buffer by half width to create polygon
            polygon = line.buffer(width / 2, cap_style=2, join_style=2)
            lane_shapes.append(polygon)
        # merge all lanes of this edge
        merged_roads.append(unary_union(lane_shapes))

    all_polygons = unary_union(merged_roads)  # merge into single geometry
    minx, miny, maxx, maxy = all_polygons.bounds
    pad = 10 # add a little padding on the edges of the network

    return {
        "polygons": [[dict(x=x, y=y) for x, y in p.exterior.coords] for p in merged_roads],
        "bounds": dict(minx=minx - pad, miny=miny - pad, maxx=maxx + pad, maxy=maxy + pad),
    }