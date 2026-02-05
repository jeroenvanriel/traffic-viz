import { useReplayController } from "../stores/ReplayController";

export default function ReplayPanel() {
  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const seek = useReplayController((s) => s.seek);

  const { isPlaying, play, pause } = useReplayController();

  if (!info) return <p>Loading...</p>

  return (
    <div>
      <h3 className="font-bold mb-2">Simulation Playback</h3>
      <div className="flex flex-col space-y-2">
      <input
        type="range"
        value={step}
        min={0}
        max={info.nSteps}
        onChange={(e) => seek(parseInt(e.target.value))}
      />

      {isPlaying ? 
      <button className="w-18 grey-button"
        onClick={pause}
        title="Pause the simulation replay.">
          Pause
      </button>
      :
      <button className="w-18 grey-button"
        onClick={play}
        title="Start the simulation replay.">
          Start
      </button>
      }
      </div>
    </div>
  );
}
