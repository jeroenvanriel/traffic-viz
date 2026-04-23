import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useReplayController } from "../stores/ReplayController";
import { useVehicleTypeStore } from "../stores/VehicleTypeStore";

export default function VehicleTypesPanel() {
  const info = useReplayController((s) => s.info);
  const vehicleTypes = info?.vehicleTypes ?? [];

  const modelByType = useVehicleTypeStore((s) => s.modelByType);
  const isLoading = useVehicleTypeStore((s) => s.isLoading);
  const error = useVehicleTypeStore((s) => s.error);
  const loadVehicleTypes = useVehicleTypeStore((s) => s.loadVehicleTypes);

  const rows = useMemo(
    () =>
      vehicleTypes.map((vehicleType) => ({
        vehicleType,
        model: modelByType[vehicleType] ?? null,
      })),
    [vehicleTypes, modelByType]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Vehicle Types</h3>
        <div className="flex items-center gap-2">
          <Link
            to="/models"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Model Library
          </Link>
          <button
            type="button"
            onClick={() => void loadVehicleTypes()}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading && rows.length === 0 && (
        <p className="text-xs text-gray-500">Loading vehicle models...</p>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">No vehicle types available for this scene yet.</p>
      ) : (
        <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {rows.map(({ vehicleType, model }) => (
            model ? (
              <li key={vehicleType}>
                <Link
                  to={`/models/${model.model_id}/configure`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-gray-900">{vehicleType}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Mapped
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-gray-500">
                    {model.stored_filename}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    original: {model.original_filename}
                  </p>
                </Link>
              </li>
            ) : (
              <li
                key={vehicleType}
                className="rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-gray-900">{vehicleType}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Default
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-gray-500">
                  fallback box mesh
                </p>
                <p className="mt-0.5 truncate text-[11px] text-gray-500">
                  original: n/a
                </p>
              </li>
            )
          ))}
        </ul>
      )}
    </div>
  );
}
