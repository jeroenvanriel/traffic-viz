from shapely.geometry import LineString, Polygon, MultiPolygon, MultiLineString, GeometryCollection
from shapely.ops import substring

DEFAULT_DASH_LENGTH = 3.0
DEFAULT_GAP_LENGTH = 3.0


def parse_sumo_coords(shape_str):
    points = [tuple(map(float, p.split(","))) for p in shape_str.split()]
    return [(x, -y) for (x, y) in points]


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


def dashed_line_to_polygons(
    line: LineString,
    width: float,
    dash_length: float = DEFAULT_DASH_LENGTH,
    gap_length: float = DEFAULT_GAP_LENGTH,
):
    """Convert a line into a polygon representation of a dashed line by buffering line segments along the line."""
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
