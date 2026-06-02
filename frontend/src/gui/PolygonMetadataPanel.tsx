import { usePolygonSelectionStore } from "../stores/RoadStore";

export default function PolygonMetadataPanel() {
  const selectedPolygon = usePolygonSelectionStore((s) => s.selectedPolygon);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Selected Polygon</h3>

        {!selectedPolygon && (
          <p className="text-xs text-gray-500">
            Click a polygon in the scene to inspect its metadata.
          </p>
        )}

        {selectedPolygon && (
          <div className="space-y-2 text-xs text-gray-700">
            <div>
              <span className="font-semibold text-gray-900">Layer: </span>
              <span>{selectedPolygon.layerName}</span>
            </div>

            {selectedPolygon.metadata && Object.keys(selectedPolygon.metadata).length > 0 ? (
              <dl className="space-y-1">
                {Object.entries(selectedPolygon.metadata).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[auto,1fr] gap-2">
                    <dt className="font-semibold text-gray-900">{key}</dt>
                    <dd className="break-all">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-gray-500">No metadata on this polygon.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
