import { create } from "zustand";
import { type WebGLRenderer } from "three";

// keep track of global three context, used for video recording

type ThreeStore = {
  gl: WebGLRenderer | null;
  setGL: (gl: WebGLRenderer) => void;
};

export const useThreeStore = create<ThreeStore>((set) => ({
  gl: null,
  setGL: (gl) => set({ gl }),
}));
