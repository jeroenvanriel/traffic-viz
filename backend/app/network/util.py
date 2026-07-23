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

    position = DEFAULT_GAP_LENGTH / 2  # Start with half a gap to center the dashes
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


class SVG:
    """Simple SVG writer for polygons with attributes."""

    def __init__(self, bounds, background="#40eba4"):
        self._bounds = bounds
        if background is not None:
            self._background = f'''
            <rect
                x="{bounds['minx']}"
                y="{bounds['miny']}"
                width="{bounds['maxx'] - bounds['minx']}"
                height="{bounds['maxy'] - bounds['miny']}"
                fill="{background}" />
            '''
        self._defs = """
        <defs>
            <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto">

                <path d="M 0,0 L 0,6 L 9,3 z" fill="black"/>
            </marker>
        </defs>
        """
        self._elements = []

    def draw_polygons(self, polys, **attrs):
        attrs = {
            # default attributes
            "fill": "none",
            "stroke": "black",
            "stroke-width": "0.2",
            # rename underscore to dash for SVG attributes
            **{k.replace("_", "-"): v for k, v in attrs.items()}
        }
        for poly in polys:
            coords = poly.exterior.coords
            path = " ".join(
                f"{'M' if i == 0 else 'L'} {x},{y}"
                for i, (x, y) in enumerate(coords)
            )
            self._elements.append(f'<path d="{path} Z" {"".join(f' {k}="{v}"' for k, v in attrs.items())} />')
        
    def draw_lines(self, lines, arrow=False, dashed=False, **attrs):
        attrs = {
            "fill": "none",
            "stroke": "black",
            "stroke-width": "0.2",
            **{"marker-end": "url(#arrow)" if arrow else {}},
            **{"stroke-dasharray": "1,1" if dashed else {}},
            # rename underscore to dash for SVG attributes
            **{k.replace("_", "-"): v for k, v in attrs.items()}
        }
        for line in lines:
            for point1, point2 in zip(line.coords[:-1], line.coords[1:]):
                x1, y1 = point1
                x2, y2 = point2
                self._elements.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" {"".join(f' {k}="{v}"' for k, v in attrs.items())} />')
    
    def draw_points(self, points, **attrs):
        attrs = {
            "fill": "black",
            "stroke": "none",
            "r": "0.1",
            # rename underscore to dash for SVG attributes
            **{k.replace("_", "-"): v for k, v in attrs.items()}
        }
        for point in points:
            x, y = point
            self._elements.append(f'<circle cx="{x}" cy="{y}" {"".join(f' {k}="{v}"' for k, v in attrs.items())} />')
    
    def draw_text(self, x, y, text, **attrs):
        attrs = {
            "fill": "black",
            "font-size": "0.5",
            # rename underscore to dash for SVG attributes
            **{k.replace("_", "-"): v for k, v in attrs.items()}
        }
        self._elements.append(f'<text x="{x}" y="{y}" {"".join(f' {k}="{v}"' for k, v in attrs.items())}>{text}</text>')

    def write(self, filename):
        svg = f'''
        <svg xmlns="http://www.w3.org/2000/svg"
            viewBox="{self._bounds['minx']} {self._bounds['miny']} {self._bounds['maxx']-self._bounds['minx']} {self._bounds['maxy']-self._bounds['miny']}">
            {self._defs}
            {self._background if hasattr(self, "_background") else ""}
            {"\n".join(self._elements)}
        </svg>
        '''

        with open(filename, "w") as f:
            f.write(svg)
