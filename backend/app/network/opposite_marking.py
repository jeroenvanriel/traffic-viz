from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree
import numpy as np
import pygeoops
from .util import iter_lines, iter_polygons, dashed_line_to_polygons


# Configuration of opposite-direction seam detection and marking
SEAM_DETECTION_EPSILON = 0.2  # Tolerance for robust boundary detection
MIN_SEAM_LENGTH = 0.5  # Minimum shared seam length to create marking
OPPOSITE_SEAM_STYLE = "dashed"  # "solid" for continuous, "dashed" for dashed


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


def compute_opposite_direction_markings(lane_records, marking_width=0.2):
    """Compute marking polygons for seams between opposite-direction lanes."""
    markings = []
    if len(lane_records) < 2:
        return []
    
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
            
            # Skip same-edge pairs (handled by compute_lane_markings)
            if rec_a["edge_id"] == rec_b["edge_id"]:
                continue
            
            # Find robust shared seams
            seams = robust_shared_boundary(poly_a, poly_b, SEAM_DETECTION_EPSILON)
            
            for seam in seams:
                # Check if opposite direction
                if seams_have_opposite_direction(rec_a["centerline"], rec_b["centerline"], seam):
                    # Convert seam to solid polygon marking
                    if OPPOSITE_SEAM_STYLE == "solid":
                        marking_poly = seam.buffer(marking_width / 2, cap_style=2, join_style=2)
                        if not marking_poly.is_empty:
                            markings.append(marking_poly)
                    elif OPPOSITE_SEAM_STYLE == "dashed":
                        dashes = dashed_line_to_polygons(
                            seam,
                            width=marking_width,
                        )
                        markings.extend(dashes)
    
    return markings
