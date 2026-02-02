import { create } from "zustand";

export type VehicleState = {
  id: string;
  x: number;
  y: number;
  z: number;
  r: number;
};

export type Delta = {
  t: number;
  c: Record<string, Partial<VehicleState>>;
  u: Record<string, Partial<VehicleState>>;
  d: string[];
};

export type Snapshot = {
  t: number;
  vehicles: Record<string, VehicleState>;
}

type VehicleStore = {
  vehicles: Record<string, VehicleState>;
  reset: () => void;
  setVehicles: (vehicles: Record<string, VehicleState>) => void;
  applyDelta: (delta: Delta) => void;
};

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicles: {},

  reset: () => set({ vehicles: {} }),

  setVehicles: (vehicles) => set({
    vehicles: Object.fromEntries(
      Object.entries(vehicles).map(([id, v]) => [id, { ...v }])
    ),
  }),

  applyDelta: (delta) =>
    set((state) => {
      const next = { ...state.vehicles };

      // create
      for (const id in delta.c) {
        next[id] = { ...(delta.c[id] as VehicleState) };
      }
      // update
      for (const id in delta.u) {
        Object.assign(next[id], delta.u[id]);
      }
      // delete
      delta.d.forEach((id) => delete next[id]);

      return { vehicles: next };
    }),
}));
