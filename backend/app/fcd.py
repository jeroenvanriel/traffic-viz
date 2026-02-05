from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import math
import json

from app.util import get_scene_root
SCENES_DIR = get_scene_root()

router = APIRouter(prefix='/scenes/{scene_id}/fcd/replay')


def diff(before, after):
    """Calculate a diff between two dicts, ignoring nan values, assuming no keys are deleted."""
    def isnan(val):
        return type(val) == float and math.isnan(val)
    return {k: v for k, v in after.items()
            if before.get(k) != v and not isnan(v)}


def dicts_diff(before, after):
    """Calculate a diff between two dicts.

    Returns: `(creation, update, deleted)`

    - `update` is a dict of diffs between old & new values for the same key
    - `creation` is a dict of new objects
    - `deleted` is a list of keys that were removed between before and after
    """
    creations = {}
    updates = {}
    deleted_keys = []

    # deleted
    for k in before:
        if k not in after:
            deleted_keys.append(k)

    # creations + updates
    for k, v in after.items():
        if k in before:
            d = diff(before[k], v)
            if len(d):
                updates[k] = d
        else:
            creations[k] = v

    return creations, updates, deleted_keys


def precompute(frames_iterable, snapshot_interval=10.0):
    """Precompute snapshots and deltas for fcd playback.
    Snapshots are taken every time at least `snapshot_interval` time has passed since the last frame.
    Hence, slightly irregular frame times are supported.
    The last frame is always added as snapshot.
    
    `frames_iterable`: yields frames as `(t: float, current_vehicles: dict)`"""

    try:
        first_t, first_vehicles = next(frames_iterable)
    except StopIteration:
        raise ValueError("frames_iterable is empty")

    # store first snapshot and delta (everything is "created")
    snapshots = { 0: { 't': first_t, 'vehicles': first_vehicles } }
    deltas = { 0: { 't': first_t, 'c': first_vehicles, 'u': {}, 'd': [] } }

    prev_snapshot_time = first_t
    prev_vehicles = first_vehicles

    # process the rest
    for i, frame in enumerate(frames_iterable):
        t, current_vehicles = frame
        c, u, d = dicts_diff(prev_vehicles, current_vehicles)
        deltas[i+1] = { 't': t, 'c': c, 'u': u, 'd': d }

        # snapshot if enough time has passed
        if (t - prev_snapshot_time >= snapshot_interval):
            snapshots[i+1] = { 't': t, 'vehicles': current_vehicles }
            prev_snapshot_time = t

        prev_vehicles = current_vehicles

    # ensure that last frame is always added as snapshot
    if i+1 not in snapshots:
        snapshots[i+1] = { 't': t, 'vehicles': current_vehicles }

    info = {
        't_min': first_t,
        't_max': t,
        'n_steps': len(deltas.keys()),
        'snapshot_interval': snapshot_interval,
    }
    
    return info, snapshots, deltas


# only use sumo parser for now
from .fcd_sumo import read_sumo_fcd
get_frames_iterable = lambda scene_id: read_sumo_fcd(f'{SCENES_DIR}/{scene_id}/fcd.xml')


@router.post("/load")
def load_scene(scene_id: str, snapshot_interval: float = Query(10.0, gt=0)):
    """Load scene by precomputing snapshots and deltas."""

    # get floating car data
    frames_iterable = get_frames_iterable(scene_id)
    if frames_iterable is None:
        raise HTTPException(404, "No floating car data found for this scene")

    info, snapshots, deltas = precompute(frames_iterable, snapshot_interval=snapshot_interval)

    # setup persistent file locations
    base_dir = Path(f'{SCENES_DIR}/{scene_id}/preprocessed')
    base_dir.mkdir(parents=True, exist_ok=True)
    snapshots_path = base_dir / 'snapshots.json'
    deltas_path = base_dir / 'deltas.json'
    info_path = base_dir / 'info.json'

    # save as JSON files
    info_path.write_text(json.dumps(info, indent=2), encoding='utf-8')
    snapshots_path.write_text(json.dumps(snapshots), encoding='utf-8')
    deltas_path.write_text(json.dumps(deltas), encoding='utf-8')

    return {
        'message': "Loading complete",
        'info': info,
        'snapshots': snapshots,
    }


@router.get('/info')
def get_info(scene_id: str):
    path = Path(f'{SCENES_DIR}/{scene_id}/preprocessed/info.json')
    if not path.exists():
        raise HTTPException(404, "Scene not preprocessed")
    return json.load(open(path))


@router.get('/snapshots')
def get_snapshot(scene_id: str):
    snapshots_path = Path(f'{SCENES_DIR}/{scene_id}/preprocessed/snapshots.json')
    if not snapshots_path.exists():
        raise HTTPException(404, "Snapshots not precomputed")
    return json.load(open(snapshots_path))


@router.get('/deltas')
def get_deltas(scene_id: str, start: int, length: int):
    deltas_path = Path(f'{SCENES_DIR}/{scene_id}/preprocessed/deltas.json')
    if not deltas_path.exists():
        raise HTTPException(404, "Deltas not precomputed")
    deltas = json.load(open(deltas_path))

    # get all deltas in the requested index range
    return [ d for i, d in deltas.items() if start <= int(i) < start + length ]
