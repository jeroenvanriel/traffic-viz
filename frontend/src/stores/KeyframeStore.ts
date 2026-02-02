import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { Vector3 } from "three";

export type CameraKeyframe = {
  id: string;
  name: string;
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
  // camera position at initial scene load
  initKeyframe:      CameraKeyframe;
  setInitKeyframe:   (position: Vector3, target: Vector3) => void;

  // keyframe management
  sequences:       CameraSequence[];
  addSequence:     (name: string) => string;
  removeSequence:  (sequenceId: string) => void;
  addKeyframe:     (sequenceId: string, keyframe: CameraKeyframe) => void;
  removeKeyframe:  (sequenceId: string, keyframeId: string) => void;
  reorderKeyframe: (sequenceId: string, from: number, to: number) => void;
};

export const useKeyframeStore = create<KeyframeStore>()(
  persist(immer((set) => ({
      initKeyframe: {
        id: 'init', name: 'Initial Keyframe',
        position: new Vector3(-10, 10, -10),
        target: new Vector3(),
        duration: 0
      },

      setInitKeyframe: (position, target) => set((state) => {
        state.initKeyframe = { ...state.initKeyframe, position: position, target: target, }
      }),

      sequences: [{ id: 'default', name: 'Default', keyframes: [] }],

      addSequence: (name) => {
        const id = nanoid();
        set((state) => { state.sequences.push({ id, name, keyframes: [] }) });
        return id;
      },

      removeSequence: (sequenceId) => set((state) => {
        if (state.sequences.length == 1) {
          // keep at least one sequence
          state.sequences = [{ id: 'default', name: 'Default', keyframes: [] }];
        } else {
          state.sequences = state.sequences.filter((s) => s.id !== sequenceId);
        }
      }),

      addKeyframe: (sequenceId, keyframe) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) seq.keyframes.push(keyframe);
      }),

      removeKeyframe: (sequenceId, keyframeId) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) seq.keyframes = seq.keyframes.filter((p) => p.id !== keyframeId)
      }),

      reorderKeyframe: (sequenceId, from, to) => set((state) => {
        const seq = state.sequences.find((s) => s.id === sequenceId);
        if (seq) {
          const newKeyframes = [...seq.keyframes];
          const [moved] = newKeyframes.splice(from, 1);
          newKeyframes.splice(to, 0, moved);
          seq.keyframes = newKeyframes;
        }
      }),
    })), { name: "camera-manager-store" })
);
