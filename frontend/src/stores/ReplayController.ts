import { create } from "zustand";
import { useVehicleStore, type Snapshot, type Delta } from "./VehicleStore";

type ReplayInfo = {
  sceneId: string;
  tMin: number;
  tMax: number;
  nSteps: number;
  snapshotInterval: number;
  vehicleTypes: string[];
};

type ReplayController = {
  info: ReplayInfo | null;
  step: number;
  time: number;
  replaySpeed: number;
  interpolationAlpha: number;
  isPlaying: boolean;
  skipVehicleInterpolation: boolean;
  snapshots: Partial<Snapshot[]>;

  deltaBuffer: Delta[];
  deltaHead: number;
  nextFetchStart: number;
  isFetching: boolean;

  play: () => void;
  pause: () => void;
  reset: () => void;

  setReplaySpeed: (replaySpeed: number) => void;
  setInterpolationAlpha: (interpolationAlpha: number) => void;

  load: (sceneId: string) => Promise<void>;
  seek: (step: number) => Promise<void>;
  fetchDeltas: () => Promise<void>;
  tick: (tDelta: number) => void;
};

export const useReplayController = create<ReplayController>((set, get) => ({
  info: null,
  step: 0,
  time: 0,
  replaySpeed: 1,
  interpolationAlpha: 0.1,
  isPlaying: false,
  skipVehicleInterpolation: false,
  snapshots: [],

  deltaBuffer: [],
  deltaHead: 0,
  nextFetchStart: 0,
  isFetching: false,

  play: async () => {
    await get().fetchDeltas();
    set({ isPlaying: true });
  },
  pause: () => set({ isPlaying: false }),
  reset: () => set({ 
    info: null, step: 0, time: 0, isPlaying: false, skipVehicleInterpolation: false, snapshots: [],
    deltaBuffer: [], deltaHead: 0, nextFetchStart: 0, isFetching: false,
  }),

  setReplaySpeed: (replaySpeed: number) => set({ replaySpeed }),
  setInterpolationAlpha: (interpolationAlpha: number) => set({ interpolationAlpha }),

  load: async (sceneId: string) => {
    const res_post = await fetch(`http://localhost:8000/api/scenes/${sceneId}/fcd/replay/load`, {
      method: "POST"
    });

    if (!res_post.ok) {
      throw new Error(`Failed to load scene ${sceneId}: ${res_post.status}`);
    }

    const res_json = await res_post.json();
    set({
      info: {
        sceneId,
        tMin: res_json.info.t_min,
        tMax: res_json.info.t_max,
        nSteps: res_json.info.n_steps,
        snapshotInterval: res_json.info.snapshot_interval,
        vehicleTypes: res_json.info.vehicle_types,
      },
      time: res_json.info.t_min,
      snapshots: res_json.snapshots
    });

    // load first batch of deltas
    await get().fetchDeltas();
  },

  seek: async (step) => {
    set({ isPlaying: false });

    const { info, snapshots } = get();
    if (!info) return;

    const maxStepIndex = info.nSteps - 1;
    const clampedStep = Math.min(Math.max(Math.round(step), 0), maxStepIndex);

    // find latest snapshot before current step
    let i = clampedStep;
    while (i > 0 && snapshots[i] === undefined) { i--; }
    const snapshot = snapshots[i];

    if (snapshot === undefined) {
      throw new Error("No snapshot before this time");
    }

    // set current vehicle positions
    const vehicles = snapshot['vehicles'];
    useVehicleStore.getState().setVehicles(vehicles);

    // set time and also clear the delta buffer
    // (which is populate separately after user stops seeking)
    set({
      step: i,
      time: snapshot['t'],
      nextFetchStart: i,
      deltaBuffer: [],
      deltaHead: 0,
      skipVehicleInterpolation: true,
    });
  },

  fetchDeltas: async () => {
    const { info, step, deltaHead, deltaBuffer, nextFetchStart, isFetching } = get();
    if (!info || isFetching) return;

    // auto-prefetch when buffer runs low and there are still unfetched deltas
    const REFETCH_THRESHOLD = 50;
    const bufferLength = deltaBuffer.length - deltaHead;
    const maxStepIndex = info.nSteps - 1;
    const bufferDone = step + bufferLength >= maxStepIndex;
    if (bufferDone || bufferLength > REFETCH_THRESHOLD) {
      return // no need to fetch additional deltas
    }

    const length = 50;
    set({ isFetching: true });

    try {
      const res: Delta[] = await fetch(
        `http://localhost:8000/api/scenes/${info.sceneId}/fcd/replay/deltas?start=${nextFetchStart}&length=${length}`
      ).then(r => r.json());

      set(state => ({
        deltaBuffer: [...state.deltaBuffer.slice(deltaHead), ...res],
        deltaHead: 0,
        nextFetchStart: state.nextFetchStart + res.length,
      }));
    } finally {
      set({ isFetching: false });
    }
  },

  tick: (tDelta) => {
    const { time, replaySpeed, isPlaying, info } = get();
    if (!info || !isPlaying) return;

    // update time
    const prevTime = time;
    const currentTime = prevTime + tDelta * replaySpeed;
    set({ time: currentTime });

    const vehicleStore = useVehicleStore.getState();
    const { deltaBuffer, deltaHead } = get();

    let i = deltaHead;
    let applied = 0;

    // apply all deltas that are due
    while (i < deltaBuffer.length && deltaBuffer[i].t <= currentTime) {
      vehicleStore.applyDelta(deltaBuffer[i]);
      i++;
      applied++;
    }

    if (applied > 0) {
      set(state => ({
        deltaHead: i,
        step: state.step + applied,
        skipVehicleInterpolation: false,
      }));
    }

    get().fetchDeltas();

    // check if done
    if (get().step >= info.nSteps - 1) {
      set({ isPlaying: false });
    }
  },

}));
