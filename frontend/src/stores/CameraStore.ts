import { create } from "zustand";
import * as three from "three";

type CameraStore = {
  camera: three.Camera | null;
  controls: any | null;
  setCameraRef: (camera: three.Camera) => void;
  setControlsRef: (controls: any) => void;

  moveCamera: (pos: three.Vector3, target: three.Vector3) => void;
  orientTopDown: () => void;
  
  currentSequence: string | null;
  setCurrentSequence: (next: string | null) => void;
};

export const useCameraStore = create<CameraStore>((set, get) => ({
  // global camera and references
  camera: null,
  controls: null,
  setCameraRef: (camera) => set({ camera }),
  setControlsRef: (controls) => set({ controls }),

  // move the camera to a specific position/orientation
  moveCamera: (pos, target) => {
    const cam = get().camera;
    const ctr = get().controls;
    if (!cam || ! ctr) return;

    // sync camera
    cam.position.copy(pos);
    cam.updateMatrixWorld(true);

    // sync controls
    ctr.target.copy(target);
    ctr.update();
  },

  orientTopDown: () => {
    const cam = get().camera;
    const ctr = get().controls;
    if (!cam || !ctr) return;

    const nextTarget = ctr.target.clone();
    console.log(nextTarget);
    const distance = Math.max(cam.position.distanceTo(nextTarget), 18);

    cam.position.set(nextTarget.x, nextTarget.y, nextTarget.z + distance);
    cam.updateMatrixWorld(true);

    ctr.target.copy(nextTarget);
    ctr.update();
  },

  // camera animation
  currentSequence: null,
  setCurrentSequence: (next) => set({ currentSequence: next }),
}));
