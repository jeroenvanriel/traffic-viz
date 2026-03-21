import { useEffect, useRef, useState } from "react";
import { useReplayController } from "../stores/ReplayController";

export default function ReplayPanel() {
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const isMapInteractingRef = useRef(false);

  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const seek = useReplayController((s) => s.seek);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const setReplaySpeed = useReplayController((s) => s.setReplaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const setInterpolationAlpha = useReplayController((s) => s.setInterpolationAlpha);

  const { isPlaying, play, pause } = useReplayController();

  useEffect(() => {
    const hideDelayMs = 20;
    const revealZonePx = 120;

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setIsPanelVisible(false);
      }, hideDelayMs);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMapInteractingRef.current) {
        return;
      }

      const isNearBottom = window.innerHeight - event.clientY <= revealZonePx;
      if (isNearBottom) {
        setIsPanelVisible(true);
        clearHideTimer();
      } else {
        scheduleHide();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const isCanvasTarget = target instanceof Element && target.closest('canvas');
      if (isCanvasTarget) {
        isMapInteractingRef.current = true;
      }
    };

    const handlePointerUp = () => {
      isMapInteractingRef.current = false;
    };

    if (!autoHideEnabled) {
      clearHideTimer();
      setIsPanelVisible(true);
      return;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      clearHideTimer();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [autoHideEnabled]);

  // Keyboard shortcuts for mode switching and saving
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inputType = target instanceof HTMLInputElement ? target.type : null;
      const isTypingInField =
        (target?.tagName === 'INPUT' && inputType !== 'range' && inputType !== 'checkbox') ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isTypingInField) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying]);

  if (!info) return null;

  return (
    <div
      className={`absolute bottom-4 z-10 left-1/2 -translate-x-1/2 w-[80%] bg-gray-100 border border-gray-300 rounded-lg shadow-lg p-4 backdrop-blur-sm transition-all duration-300 ${
        isPanelVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      onMouseEnter={() => setIsPanelVisible(true)}
    >
      <div className="space-y-3">
        {/* Main Step Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm">Step</h3>
            <span className="text-sm font-mono">{step} / {info.nSteps}</span>
          </div>
          <input
            type="range"
            value={step}
            min={0}
            max={info.nSteps}
            onChange={(e) => seek(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Secondary row in a narrower container */}
        <div className="pt-2 border-t border-gray-300">
          <div className="flex items-end gap-3">
            <div className="max-w-3xl w-full mr-auto">
              <div className="flex gap-3 items-end">
                {/* Play/Pause Button */}
                <div className="w-30 shrink-0">
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

                <div className="flex-1 grid grid-cols-2 gap-3">
                  {/* Speed Slider */}
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
                      className="w-full"
                    />
                  </div>

                  {/* Interpolation Alpha Slider */}
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
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 self-end ml-auto">
              <label className="flex items-center gap-1 text-xs text-gray-700 select-none text-right">
                <input
                  type="checkbox"
                  checked={autoHideEnabled}
                  onChange={(e) => setAutoHideEnabled(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Auto-hide panel
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
