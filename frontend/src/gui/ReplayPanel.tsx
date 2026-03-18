import { useReplayController } from "../stores/ReplayController";

export default function ReplayPanel() {
  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const seek = useReplayController((s) => s.seek);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const setReplaySpeed = useReplayController((s) => s.setReplaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const setInterpolationAlpha = useReplayController((s) => s.setInterpolationAlpha);

  const { isPlaying, play, pause } = useReplayController();

  if (!info) return <p>Loading...</p>

  return (
    <div>
      <h3 className="font-bold mb-2">Simulation Playback</h3>
      <div className="flex flex-col space-y-2">
        <h4 className="mb-2">Step</h4>
        <input
          type="range"
          value={step}
          min={0}
          max={info.nSteps}
          onChange={(e) => seek(parseInt(e.target.value))}
        />
        <span>{step}</span>

        <h4 className="mb-2">Speed</h4>
        <input
          type="range"
          value={replaySpeed}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => setReplaySpeed(Number(e.target.value))}
        />
        <span>{replaySpeed}</span>

        <h4 className="mb-2">Alpha (interpolation)</h4>
        <input
          type="range"
          value={interpolationAlpha}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(e) => setInterpolationAlpha(Number(e.target.value))}
        />
        <span>{interpolationAlpha}</span>

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
