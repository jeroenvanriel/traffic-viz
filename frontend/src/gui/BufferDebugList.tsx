import { useReplayController } from "../stores/ReplayController";

export default function BufferDebugList() {
  const deltas = useReplayController(s => s.deltaBuffer);

  return (
    <>
      <h3 className="font-bold mb-1">Deltas<span className="">({Object.keys(deltas).length})</span></h3>
      <div className="flex-1 overflow-y-auto scroll-dark">
        <ul>
          {Object.entries(deltas).map(([k, v]) => (
            <li key={k}>
              {k}: {JSON.stringify(v)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
