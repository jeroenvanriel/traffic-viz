import { useRoadLayerStore } from "../stores/RoadLayerStore";

export default function LayerVisibilityPanel() {
  const availableLayers = useRoadLayerStore((s) => s.availableLayers);
  const layerVisibility = useRoadLayerStore((s) => s.layerVisibility);
  const setLayerVisibility = useRoadLayerStore((s) => s.setLayerVisibility);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Road Layers</h3>
        {availableLayers.length === 0 && (
          <div className="text-xs text-gray-500">No layers available.</div>
        )}
        {availableLayers.map((layerId) => (
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
            {layerId
              .replace(/_/g, " ")
              .replace(/\b\w/g, (ch) => ch.toUpperCase())}
          </label>
        ))}
      </div>
    </div>
  );
}
