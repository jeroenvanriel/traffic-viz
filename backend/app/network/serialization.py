from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString

def serialize_polygon(p: Polygon):
    return {
        "outer": [{"x": x, "y": y} for x, y in p.exterior.coords],
        "holes": [
            [{"x": x, "y": y} for x, y in interior.coords]
            for interior in p.interiors
        ],
    }

def serialize_polygons(polygons):
    result = []

    for p in polygons:
        if isinstance(p, Polygon):
            result.append(serialize_polygon(p))

        elif isinstance(p, MultiPolygon):
            for sub in p.geoms:
                result.append(serialize_polygon(sub))

    return result

def serialize_lines(lines):
    result = []

    for line in lines:
        if isinstance(line, LineString):
            result.append([{"x": x, "y": y} for x, y in line.coords])

        elif isinstance(line, MultiLineString):
            for sub in line.geoms:
                result.append([{"x": x, "y": y} for x, y in sub.coords])

    return result
