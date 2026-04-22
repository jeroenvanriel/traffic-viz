import { useReplayController } from "../stores/ReplayController";

export default function PlaybackControls() {
  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const isPlaying = useReplayController((s) => s.isPlaying);
  const play = useReplayController((s) => s.play);
  const pause = useReplayController((s) => s.pause);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const setReplaySpeed = useReplayController((s) => s.setReplaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const setInterpolationAlpha = useReplayController((s) => s.setInterpolationAlpha);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Playback Controls</h3>
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700">Step</span>
        <span className="text-xs font-mono text-gray-700">
          {step} / {(info?.nSteps ?? 1) - 1}
        </span>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-gray-700">Speed</label>
          <span className="text-xs font-mono text-gray-700">{replaySpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          value={replaySpeed}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => setReplaySpeed(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-gray-700">Interpolation</label>
          <span className="text-xs font-mono text-gray-700">{interpolationAlpha.toFixed(2)}</span>
        </div>
        <input
          type="range"
          value={interpolationAlpha}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(e) => setInterpolationAlpha(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
      </div>

      <div>
        {isPlaying ? (
          <button
            onClick={pause}
            title="Pause the simulation replay."
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-sm cursor-pointer"
          >
            Pause (SPC)
          </button>
        ) : (
          <button
            onClick={play}
            title="Start the simulation replay."
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-sm cursor-pointer"
          >
            Play (SPC)
          </button>
        )}
      </div>
    </div>
  );
}