import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { Vector3 } from "three";

export type CameraKeyframe = {
  id: string;
  position: Vector3;
  target: Vector3;
  duration: number;
};

export type CameraSequence = {
  id: string;
  name: string;
  keyframes: CameraKeyframe[];
};

type KeyframeStore = {
  currentSceneId: string | null;
  loadSequences: (sceneId: string) => Promise<void>;

  // keyframe management
  sequences:       CameraSequence[];
  addSequence:     (name: string) => string;
  removeSequence:  (sequenceId: string) => void;
  addKeyframe:     (sequenceId: string, keyframe: CameraKeyframe) => void;
  removeKeyframe:  (sequenceId: string, keyframeId: string) => void;
  reorderKeyframe: (sequenceId: string, from: number, to: number) => void;
};

type Vec3Payload = { x: number; y: number; z: number };

type CameraKeyframePayload = {
  id: string;
  position: Vec3Payload;
  target: Vec3Payload;
  duration: number;
};

type CameraSequencePayload = {
  id: string;
  name: string;
  keyframes: CameraKeyframePayload[];
};

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
    keyframes: sequence.keyframes.map((k) => ({
      id: k.id,
      position: vectorToPayload(k.position),
      target: vectorToPayload(k.target),
      duration: k.duration,
    })),
  };
}

function toSequence(payload: CameraSequencePayload): CameraSequence {
  return {
    id: payload.id,
    name: payload.name,
    keyframes: payload.keyframes.map((k) => ({
      id: k.id,
      position: payloadToVector(k.position),
      target: payloadToVector(k.target),
      duration: k.duration,
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
        const nextSequences = sequences.length > 0 ? sequences : [{ id: "default", name: "Default", keyframes: [] }];

        set((state) => {
          state.currentSceneId = sceneId;
          state.sequences = nextSequences;
        });

        if (sequences.length === 0) {
          const defaultSequence = nextSequences[0];
          if (defaultSequence) {
            void saveSequence(sceneId, defaultSequence).catch((err) => {
              console.error("Failed to persist default camera sequence", err);
            });
          }
        }
      },

      sequences: [{ id: 'default', name: 'Default', keyframes: [] }],

      addSequence: (name) => {
        const id = nanoid();
        const sequence = { id, name, keyframes: [] };
        set((state) => { state.sequences.push(sequence) });

        const sceneId = get().currentSceneId;
        if (sceneId) {
          void saveSequence(sceneId, sequence).catch((err) => {
            console.error("Failed to persist camera sequence", err);
          });
        }

        return id;
      },

      removeSequence: (sequenceId) => set((state) => {
        const sceneId = get().currentSceneId;
        if (state.sequences.length == 1) {
          if (sceneId) {
            void deleteSequence(sceneId, sequenceId).catch((err) => {
              console.error("Failed to delete camera sequence", err);
            });
          }

          // keep at least one sequence
          const defaultSequence = { id: 'default', name: 'Default', keyframes: [] };
          state.sequences = [defaultSequence];

          if (sceneId) {
            void saveSequence(sceneId, defaultSequence).catch((err) => {
              console.error("Failed to persist default camera sequence", err);
            });
          }
        } else {
          state.sequences = state.sequences.filter((s) => s.id !== sequenceId);

          if (sceneId) {
            void deleteSequence(sceneId, sequenceId).catch((err) => {
              console.error("Failed to delete camera sequence", err);
            });
          }
        }
      }),

      addKeyframe: (sequenceId, keyframe) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          seq.keyframes.push(keyframe);

          const sceneId = get().currentSceneId;
          if (sceneId) {
            void saveSequence(sceneId, seq).catch((err) => {
              console.error("Failed to persist camera sequence", err);
            });
          }
        }
      }),

      removeKeyframe: (sequenceId, keyframeId) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          seq.keyframes = seq.keyframes.filter((p) => p.id !== keyframeId);

          const sceneId = get().currentSceneId;
          if (sceneId) {
            void saveSequence(sceneId, seq).catch((err) => {
              console.error("Failed to persist camera sequence", err);
            });
          }
        }
      }),

      reorderKeyframe: (sequenceId, from, to) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          const newKeyframes = [...seq.keyframes];
          const [moved] = newKeyframes.splice(from, 1);
          newKeyframes.splice(to, 0, moved);
          seq.keyframes = newKeyframes;

          const sceneId = get().currentSceneId;
          if (sceneId) {
            void saveSequence(sceneId, seq).catch((err) => {
              console.error("Failed to persist camera sequence", err);
            });
          }
        }
      }),
    }))
);
