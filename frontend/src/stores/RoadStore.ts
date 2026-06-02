import { create } from "zustand";

export type Point = { x: number; y: number; z?: number };

export type Path = Point[];

export type Polygon = {
  outer: Path;
  holes: Path[];
}

// We use "Shape" to denote an annotated polygon, where the metadata can contain any additional
// information from the original XML description (e.g. lane_id, edge_id, etc.). Note that this 
// has nothing to do with the Shape type from three.js.
export type PolygonMetadata = Record<string, unknown>;
export type Shape = {
  polygon: Polygon;
  metadata?: PolygonMetadata;
}

export type RoadLayer = {
  name: string;
  debug: boolean;
  shapes: Shape[];
}

export type RoadBounds = { minx: number; miny: number; maxx: number; maxy: number };

const DEFAULT_BOUNDS = { minx: -50, miny: -50, maxx: 50, maxy: 50 };

type RoadData = {
  layers: Record<string, RoadLayer>;
  debug_layers: Record<string, RoadLayer>;
  bounds: RoadBounds;
}

type RoadStore = {
  bounds: RoadBounds;
  layers: Record<string, RoadLayer>;
  debugLayers: Record<string, RoadLayer>;
  layerVisibility: Record<string, boolean>;
  loading: boolean;
  reset: () => void;
  load: (sceneId: string) => Promise<void>;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
};

export const useRoadStore = create<RoadStore>((set) => ({
  bounds: DEFAULT_BOUNDS,
  layers: {},
  debugLayers: {},
  layerVisibility: {},

  loading: false,

  reset: () => {
    set({
      bounds: DEFAULT_BOUNDS,
      layers: {},
      debugLayers: {},
      layerVisibility: {},
    });
  },

  load: async (sceneId) => {
    set({ loading: true });

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/road`);
      const data: RoadData = await response.json();

      set({
        bounds: data.bounds,
        layers: data.layers,
        debugLayers: data.debug_layers,
        // By default, show all regular layers and hide debug layers
        layerVisibility: Object.fromEntries([
          ...Object.keys(data.layers).map((l: string) => [l, true]),
          ...Object.keys(data.debug_layers).map((l: string) => [l, false])
        ]),
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load road network", err);
      set({
        bounds: DEFAULT_BOUNDS,
        layers: {},
        debugLayers: {},
        layerVisibility: {},
        loading: false,
      });
    }
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

export type SelectedPolygon = {
  layerId: string;
  layerName: string;
  polygonIndex: number;
  metadata: PolygonMetadata | null;
};

type PolygonSelectionStore = {
  selectedPolygon: SelectedPolygon | null;
  setSelectedPolygon: (selection: SelectedPolygon) => void;
  clearSelectedPolygon: () => void;
};

export const usePolygonSelectionStore = create<PolygonSelectionStore>((set) => ({
  selectedPolygon: null,

  setSelectedPolygon: (selection) => {
    set({ selectedPolygon: selection });
  },

  clearSelectedPolygon: () => {
    set({ selectedPolygon: null });
  },
}));
