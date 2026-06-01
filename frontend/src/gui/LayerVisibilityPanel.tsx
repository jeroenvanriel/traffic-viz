import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { useRoadLayerStore } from "../stores/RoadLayerStore";

function LayerCheckbox({ layerId }: { layerId: string }) {
  const layerVisibility = useRoadLayerStore((s) => s.layerVisibility);
  const setLayerVisibility = useRoadLayerStore((s) => s.setLayerVisibility);

  return (
    <label
      key={layerId}
      className="flex items-center gap-2 text-xs font-medium text-gray-700 select-none cursor-pointer"
    >
      <input
        type="checkbox"
        checked={layerVisibility[layerId] !== false}
        onChange={(e) => setLayerVisibility(layerId, e.target.checked)}
        className="h-4 w-4 cursor-pointer"
      />
      {layerId.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
    </label>
  );
}

export default function LayerVisibilityPanel() {
  const availableLayers = useRoadLayerStore((s) => s.availableLayers);
  const [debugLayersOpen, setDebugLayersOpen] = useState(false);

  const baseLayers = availableLayers.filter((layerId) => !layerId.startsWith("debug_"));
  const debugLayers = availableLayers.filter((layerId) => layerId.startsWith("debug_"));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Road Layers</h3>
        {availableLayers.length === 0 && (
          <div className="text-xs text-gray-500">No layers available.</div>
        )}
        <div className="space-y-2">
          {baseLayers.map((layerId) => (
            <LayerCheckbox key={layerId} layerId={layerId} />
          ))}
        </div>

        {debugLayers.length > 0 && (
          <div className="border-t border-dashed border-gray-200 pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700"
              aria-expanded={debugLayersOpen}
              onClick={() => setDebugLayersOpen((value) => !value)}
            >
              <span>Debug Layers</span>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${debugLayersOpen ? "rotate-180" : ""}`}
              />
            </button>

            {debugLayersOpen && (
              <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-3">
                {debugLayers.map((layerId) => (
                  <LayerCheckbox key={layerId} layerId={layerId} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
