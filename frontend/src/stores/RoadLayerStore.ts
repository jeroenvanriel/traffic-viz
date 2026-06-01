import { create } from "zustand";

export const DEFAULT_LAYER_VISIBILITY: Record<string, boolean> = {
  road: true,
  edge_markings: true,
  opposite_markings: true,
};

const DEBUG_LAYER_PREFIX = "debug_";

export function getDefaultLayerVisibility(layerId: string): boolean {
  if (layerId in DEFAULT_LAYER_VISIBILITY) {
    return DEFAULT_LAYER_VISIBILITY[layerId];
  }

  return !layerId.startsWith(DEBUG_LAYER_PREFIX);
}

type RoadLayerStore = {
  availableLayers: string[];
  layerVisibility: Record<string, boolean>;
  reset: () => void;
  setAvailableLayers: (layerIds: string[]) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
};

const DEFAULT_LAYER_IDS = Object.keys(DEFAULT_LAYER_VISIBILITY);

export const useRoadLayerStore = create<RoadLayerStore>((set) => ({
  availableLayers: DEFAULT_LAYER_IDS,
  layerVisibility: DEFAULT_LAYER_VISIBILITY,

  reset: () => {
    set({
      availableLayers: DEFAULT_LAYER_IDS,
      layerVisibility: DEFAULT_LAYER_VISIBILITY,
    });
  },

  setAvailableLayers: (layerIds) => {
    set((state) => {
      const nextVisibility: Record<string, boolean> = {};
      for (const layerId of layerIds) {
        if (layerId in state.layerVisibility) {
          nextVisibility[layerId] = state.layerVisibility[layerId];
        } else {
          nextVisibility[layerId] = getDefaultLayerVisibility(layerId);
        }
      }

      return {
        availableLayers: layerIds,
        layerVisibility: nextVisibility,
      };
    });
  },

  setLayerVisibility: (layerId, visible) => {
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerId]: visible,
      },
    }));
  },
}));
