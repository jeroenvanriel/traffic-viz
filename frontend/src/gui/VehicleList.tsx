import { useVehicleStore } from "../stores/VehicleStore";

export default function VehicleList() {
  const vehicles = useVehicleStore((s) => s.vehicles);

  return (
    <>
      <h3 className="font-bold mb-1">Vehicles <span className="">({Object.keys(vehicles).length})</span></h3>
      <div className="flex-1 overflow-y-auto scroll-dark">
        <ul>
          {Object.values(vehicles).map((v) => (
            <li key={v.id}>
              {v.id}: x={v.x.toFixed(2)}, z={v.z.toFixed(2)}, r={v.r.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
