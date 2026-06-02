import { useRef, useState, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { useRoadStore, usePolygonSelectionStore } from "../stores/RoadStore";

type TriStateCheckboxProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    indeterminate: boolean;
  };
function TriStateCheckbox({
  indeterminate,
  ...props
}: TriStateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={props.checked}
      {...props}
    />
  );
}

function LayerCheckbox({
  layerId,
  layerName,
  isSelected,
}: {
  layerId: string;
  layerName: string;
  isSelected: boolean;
}) {
  const layerVisibility = useRoadStore((s) => s.layerVisibility);
  const setLayerVisibility = useRoadStore((s) => s.setLayerVisibility);
  const selectedPolygon = usePolygonSelectionStore((s) => s.selectedPolygon);
  const clearSelectedPolygon = usePolygonSelectionStore((s) => s.clearSelectedPolygon);
  const hiddenShapes = useRoadStore((s) => s.hiddenShapes[layerId]?.size ?? 0);
  const totalShapes = useRoadStore((s) => s.layers[layerId]?.shapes.length ?? s.debugLayers[layerId]?.shapes.length ?? 0);

  let state: "checked" | "unchecked" | "indeterminate";
  if (hiddenShapes === 0 && layerVisibility[layerId] !== false) {
    state = "checked";
  } else if (layerVisibility[layerId] === false) {
    state = "unchecked";
  } else {
    state = "indeterminate";
  }

  return (
    <label
      key={layerId}
      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium select-none cursor-pointer transition ${
        isSelected
          ? "border-purple-200 bg-purple-50 text-purple-700"
          : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      <TriStateCheckbox
        checked={state === "checked"}
        indeterminate={state === "indeterminate"}
        onChange={(e) => {
          const visible = e.target.checked;
          setLayerVisibility(layerId, visible);

          if (
            !visible &&
            selectedPolygon?.layerId === layerId
          ) {
            clearSelectedPolygon();
          }
        }}
        className="h-4 w-4 cursor-pointer"
      />
      {layerName}
      <span className="text-gray-500">
        ({totalShapes} shapes)
      </span>
      {state === "indeterminate" && (
        <span className="text-gray-500">
          ({hiddenShapes} hidden)
        </span>
      )}
    </label>
  );
}

export default function LayerVisibilityPanel() {
  const layers = useRoadStore((s) => s.layers);
  const debugLayers = useRoadStore((s) => s.debugLayers);
  const selectedLayerId = usePolygonSelectionStore((s) => s.selectedPolygon?.layerId ?? null);
  const [debugLayersOpen, setDebugLayersOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Road Layers</h3>
        {Object.values(layers).length === 0 && (
          <div className="text-xs text-gray-500">No layers available.</div>
        )}
        <div className="space-y-2">
          {Object.entries(layers).map(([layerId, layer]) => (
            <LayerCheckbox
              key={layerId}
              layerId={layerId}
              layerName={layer.name}
              isSelected={selectedLayerId === layerId}
            />
          ))}
        </div>

        {Object.values(debugLayers).length > 0 && (
          <div className="border-t border-dashed border-gray-200 pt-3">
            <button
              type="button"
              className="cursor-pointer flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700"
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
                {Object.entries(debugLayers).map(([layerId, layer]) => (
                  <LayerCheckbox
                    key={layerId}
                    layerId={layerId}
                    layerName={layer.name}
                    isSelected={selectedLayerId === layerId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
