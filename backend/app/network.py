from fastapi import APIRouter
import xml.etree.ElementTree as ET
from shapely.geometry import LineString, Polygon
from shapely import MultiPolygon

from app.util import get_root_folder

router = APIRouter(prefix="/scenes/{scene_id}")

@router.get("/road")
async def get_road_network(scene_id: str):
    road_file = get_root_folder() / "scenes" / scene_id / "road.net.xml"
    tree = ET.parse(road_file)
    root = tree.getroot()
    polygons = []

    def parse_SUMO_coords(shape_str):
        # NOTE: we need to flip y-coords for SUMO
        points = [tuple(map(float, p.split(","))) for p in shape_str.split()]
        return [(x, -y) for (x, y) in points]

    for edge in root.findall("edge"):
        # no need to draw lanes within junctions
        if edge.get("function") == "internal":
            continue

        lanes = edge.findall("lane")
        for lane in lanes:
            shape_str = lane.get("shape")
            points = parse_SUMO_coords(shape_str)
            if len(points) == 0: # ignore invalid lines
                continue
            shape = LineString(points)

            # buffer by half width to create polygon
            width = float(lane.get("width", 3.2)) # default lane width in SUMO is 3.2m
            polygon = shape.buffer(width / 2, cap_style=2, join_style=2)
            if not polygon.is_empty:
                polygons.append(polygon)

    for junction in root.findall("junction"):
        shape_str = junction.get("shape")
        if shape_str is None:
            continue
        points = parse_SUMO_coords(shape_str)
        if len(points) <= 2: # ignore invalid polygons
            continue
        shape = Polygon(points)
        polygons.append(shape)

    # compute bounds of all polygons together
    minx, miny, maxx, maxy = MultiPolygon(polygons).bounds
    pad = 10 # extra padding for the bounds
    return {
        "polygons": [
            {
                "outer": [dict(x=x, y=y) for x, y in p.exterior.coords],
                "holes": [
                    [dict(x=x, y=y) for x, y in interior.coords]
                    for interior in p.interiors
                ],
            }
            for p in polygons],
        "bounds": dict(minx=minx - pad, miny=miny - pad, maxx=maxx + pad, maxy=maxy + pad),
    }
