import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { Vector3 } from "three";

export type CameraKeyframe = {
  id: string;
  position: Vector3;
  target: Vector3;
  step: number;
};

export type CameraSequence = {
  id: string;
  name: string;
  interpolationType: "linear" | "catmull_rom";
  keyframes: CameraKeyframe[];
};

type KeyframeStore = {
  currentSceneId: string | null;
  loadSequences: (sceneId: string) => Promise<void>;
  persistSequence: (sequenceId: string) => void;

  // keyframe management
  sequences:       CameraSequence[];
  addSequence:     (name: string) => string;
  removeSequence:  (sequenceId: string) => void;
  renameSequence:  (sequenceId: string, name: string) => void;
  setInterpolationType: (sequenceId: string, interpolationType: "linear" | "catmull_rom") => void;
  upsertKeyframe:  (sequenceId: string, keyframe: CameraKeyframe) => void;
  updateKeyframePose: (sequenceId: string, keyframeId: string, position: Vector3, target: Vector3) => void;
  setKeyframeStep: (sequenceId: string, keyframeId: string, step: number, persist?: boolean) => void;
  removeKeyframe:  (sequenceId: string, keyframeId: string) => void;
};

type Vec3Payload = { x: number; y: number; z: number };

type CameraKeyframePayload = {
  id: string;
  position: Vec3Payload;
  target: Vec3Payload;
  step: number;
};

type CameraSequencePayload = {
  id: string;
  name: string;
  interpolation_type?: "linear" | "catmull_rom";
  keyframes: CameraKeyframePayload[];
};

function clampStep(step: number): number {
  return Math.max(0, Math.round(step));
}

function sortKeyframes(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  return [...keyframes].sort((a, b) => a.step - b.step);
}

function vectorToPayload(v: Vector3): Vec3Payload {
  return { x: v.x, y: v.y, z: v.z };
}

function payloadToVector(v: Vec3Payload): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

function toSequencePayload(sequence: CameraSequence): CameraSequencePayload {
  return {
    id: sequence.id,
    name: sequence.name,
    interpolation_type: sequence.interpolationType,
    keyframes: sequence.keyframes.map((k) => ({
      id: k.id,
      position: vectorToPayload(k.position),
      target: vectorToPayload(k.target),
      step: clampStep(k.step),
    })),
  };
}

function toSequence(payload: CameraSequencePayload): CameraSequence {
  return {
    id: payload.id,
    name: payload.name,
    interpolationType: payload.interpolation_type ?? "linear",
    keyframes: sortKeyframes(payload.keyframes.map((k) => {
      return {
        id: k.id,
        position: payloadToVector(k.position),
        target: payloadToVector(k.target),
        step: clampStep(k.step),
      };
    })),
  };
}

async function saveSequence(sceneId: string, sequence: CameraSequence): Promise<void> {
  const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/camera/sequences/${sequence.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSequencePayload(sequence)),
  });

  if (!response.ok) {
    throw new Error(`Failed to save sequence ${sequence.id}: ${response.status}`);
  }
}

async function deleteSequence(sceneId: string, sequenceId: string): Promise<void> {
  const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/camera/sequences/${sequenceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete sequence ${sequenceId}: ${response.status}`);
  }
}

function persistSequenceNow(sceneId: string | null, sequence: CameraSequence | undefined): void {
  if (!sceneId || !sequence) return;
  void saveSequence(sceneId, sequence).catch((err) => {
    console.error("Failed to persist camera sequence", err);
  });
}

export const useKeyframeStore = create<KeyframeStore>()(
  immer((set, get) => ({
      currentSceneId: null,

      loadSequences: async (sceneId) => {
        const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/camera/sequences`);
        if (!response.ok) {
          throw new Error(`Failed to load camera sequences: ${response.status}`);
        }

        const data = await response.json() as { sequences: CameraSequencePayload[] };
        const sequences = data.sequences.map(toSequence);

        set((state) => {
          state.currentSceneId = sceneId;
          state.sequences = sequences;
        });
      },

      sequences: [],

      persistSequence: (sequenceId) => {
        const sceneId = get().currentSceneId;
        const sequence = get().sequences.find((s) => s.id === sequenceId);
        persistSequenceNow(sceneId, sequence);
      },

      addSequence: (name) => {
        const id = nanoid();
        const sequence: CameraSequence = { id, name, interpolationType: "linear", keyframes: [] };
        set((state) => { state.sequences.push(sequence) });

        const sceneId = get().currentSceneId;
        persistSequenceNow(sceneId, sequence);

        return id;
      },

      removeSequence: (sequenceId) => set((state) => {
        const sceneId = get().currentSceneId;
        state.sequences = state.sequences.filter((s) => s.id !== sequenceId);

        if (sceneId) {
          void deleteSequence(sceneId, sequenceId).catch((err) => {
            console.error("Failed to delete camera sequence", err);
          });
        }
      }),

      renameSequence: (sequenceId, name) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          seq.name = name;
          persistSequenceNow(get().currentSceneId, seq);
        }
      }),

      setInterpolationType: (sequenceId, interpolationType) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          seq.interpolationType = interpolationType;
          persistSequenceNow(get().currentSceneId, seq);
        }
      }),
    
      upsertKeyframe: (sequenceId, keyframe) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          const existing = seq.keyframes.find((k) => k.id === keyframe.id);
          const nextKeyframe: CameraKeyframe = {
            ...keyframe,
            step: clampStep(keyframe.step),
          };

          if (existing) {
            existing.position = nextKeyframe.position;
            existing.target = nextKeyframe.target;
            existing.step = nextKeyframe.step;
          } else {
            seq.keyframes.push(nextKeyframe);
          }

          seq.keyframes = sortKeyframes(seq.keyframes);
          persistSequenceNow(get().currentSceneId, seq);
        }
      }),

      updateKeyframePose: (sequenceId, keyframeId, position, target) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        const keyframe = seq?.keyframes.find((k) => k.id === keyframeId);
        if (seq && keyframe) {
          keyframe.position = position;
          keyframe.target = target;
          persistSequenceNow(get().currentSceneId, seq);
        }
      }),

      setKeyframeStep: (sequenceId, keyframeId, step, persist = true) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        const keyframe = seq?.keyframes.find((k) => k.id === keyframeId);
        if (seq && keyframe) {
          keyframe.step = clampStep(step);
          seq.keyframes = sortKeyframes(seq.keyframes);

          if (persist) {
            persistSequenceNow(get().currentSceneId, seq);
          }
        }
      }),

      removeKeyframe: (sequenceId, keyframeId) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          seq.keyframes = seq.keyframes.filter((p) => p.id !== keyframeId);
          persistSequenceNow(get().currentSceneId, seq);
        }
      }),
    }))
);
