import { useEffect } from "react";
import { create } from "zustand";

export type Vec3 = [number, number, number];

export type TransformConfig = {
  scale: Vec3;
  rotation: Vec3;
  offset: Vec3;
};

export type VehicleTypeModel = {
  model_id: string;
  url: string;
  stored_filename: string;
  original_filename: string;
  transform_config: TransformConfig;
};

export type VehicleTypesResponse = Record<string, VehicleTypeModel>;

type VehicleTypeStore = {
  modelByType: VehicleTypesResponse;
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  reset: () => void;
  loadVehicleTypes: () => Promise<void>;
};

export const useVehicleTypeStore = create<VehicleTypeStore>((set) => ({
  modelByType: {},
  isLoading: false,
  error: null,
  lastLoadedAt: null,

  reset: () =>
    set({
      modelByType: {},
      isLoading: false,
      error: null,
      lastLoadedAt: null,
    }),

  loadVehicleTypes: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch("http://localhost:8000/api/vehicle-types");
      if (!res.ok) {
        throw new Error(`Failed to load vehicle types: ${res.status}`);
      }

      const mapping: VehicleTypesResponse = await res.json();
      set({
        modelByType: mapping,
        isLoading: false,
        error: null,
        lastLoadedAt: Date.now(),
      });
    } catch (err) {
      set({
        modelByType: {},
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
}));

let syncSubscriberCount = 0;
let syncCleanup: (() => void) | null = null;

function ensureVehicleTypeSyncStarted() {
  if (syncCleanup) {
    return;
  }

  const load = () => {
    void useVehicleTypeStore.getState().loadVehicleTypes();
  };

  const handleModelUpdateBroadcast = (event: MessageEvent) => {
    if (event.data?.type === "model-transform-updated") {
      load();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      load();
    }
  };

  const handleWindowFocus = () => {
    load();
  };

  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("model-config-updates")
      : null;

  channel?.addEventListener("message", handleModelUpdateBroadcast);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleWindowFocus);

  load();

  syncCleanup = () => {
    channel?.removeEventListener("message", handleModelUpdateBroadcast);
    channel?.close();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleWindowFocus);
  };
}

function stopVehicleTypeSyncIfNeeded() {
  if (syncSubscriberCount > 0 || !syncCleanup) {
    return;
  }

  syncCleanup();
  syncCleanup = null;
}

export function useVehicleTypeSync(sceneId?: string) {
  useEffect(() => {
    if (!sceneId) {
      return;
    }

    syncSubscriberCount += 1;
    ensureVehicleTypeSyncStarted();

    return () => {
      syncSubscriberCount = Math.max(0, syncSubscriberCount - 1);
      stopVehicleTypeSyncIfNeeded();
    };
  }, [sceneId]);
}
