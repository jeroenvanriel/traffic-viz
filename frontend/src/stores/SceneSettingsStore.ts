import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Vector3 } from "three";

export type InitialCameraState = {
  position: Vector3;
  target: Vector3;
};

type Vec3Payload = { x: number; y: number; z: number };

type InitialCameraStatePayload = {
  position: Vec3Payload;
  target: Vec3Payload;
};

type SceneSettingsPayload = {
  initCameraState: InitialCameraStatePayload;
};

type SceneSettingsStore = {
  currentSceneId: string | null;
  initCameraState: InitialCameraState;

  loadSceneSettings: (sceneId: string) => Promise<void>;
  setInitCameraState: (position: Vector3, target: Vector3) => void;
};

function vectorToPayload(v: Vector3): Vec3Payload {
  return { x: v.x, y: v.y, z: v.z };
}

function payloadToVector(v: Vec3Payload): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

function toPayload(settings: InitialCameraState): SceneSettingsPayload {
  return {
    initCameraState: {
      position: vectorToPayload(settings.position),
      target: vectorToPayload(settings.target),
    },
  };
}

function fromPayload(payload: SceneSettingsPayload): InitialCameraState {
  return {
    position: payloadToVector(payload.initCameraState.position),
    target: payloadToVector(payload.initCameraState.target),
  };
}

async function saveSceneSettings(sceneId: string, initCameraState: InitialCameraState): Promise<void> {
  const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(initCameraState)),
  });

  if (!response.ok) {
    throw new Error(`Failed to save scene settings: ${response.status}`);
  }
}

export const useSceneSettingsStore = create<SceneSettingsStore>()(
  immer((set, get) => ({
    currentSceneId: null,
    initCameraState: {
      position: new Vector3(-10, 10, -10),
      target: new Vector3(),
    },

    loadSceneSettings: async (sceneId) => {
      const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/settings`);
      if (!response.ok) {
        throw new Error(`Failed to load scene settings: ${response.status}`);
      }

      const payload = await response.json() as SceneSettingsPayload;
      set((state) => {
        state.currentSceneId = sceneId;
        state.initCameraState = fromPayload(payload);
      });
    },

    setInitCameraState: (position, target) => {
      set((state) => {
        state.initCameraState = {
          position: position.clone(),
          target: target.clone(),
        };
      });

      const sceneId = get().currentSceneId;
      if (sceneId) {
        const state = get();
        void saveSceneSettings(sceneId, state.initCameraState).catch((err) => {
          console.error("Failed to persist scene settings", err);
        });
      }
    },
  }))
);
