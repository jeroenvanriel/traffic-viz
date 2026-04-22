import { useEffect, useState } from "react";
import { useCallback } from "react";
import type { RefObject } from "react";
import { useReplayController } from "../stores/ReplayController";
import { CameraTimelineLayer, KEYFRAME_KNOB_Y } from "./CameraTimelineEditor";
import {
  TIMELINE_BASELINE_Y,
  TIMELINE_INTERACTION_SPLIT_Y,
  TIMELINE_PADDING_X,
  TIMELINE_VIEWBOX_HEIGHT,
  TIMELINE_VIEWBOX_WIDTH,
  toSvgXFromClientX,
  toStepFromSvgX,
  toXFromStep,
} from "./timelineGeometry";
import type { CameraTimelineEditorBindings } from "./CameraTimelineEditor";

export default function ReplayPanel({
  cameraTimeline,
  timelineRef,
  isVisible,
}: {
  cameraTimeline: CameraTimelineEditorBindings;
  timelineRef: RefObject<SVGSVGElement | null>;
  isVisible: boolean;
}) {
  const [isSeeking, setIsSeeking] = useState(false);

  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const seek = useReplayController((s) => s.seek);

  const { isPlaying, play, pause } = useReplayController();
  const {
    keyframes,
    activeKeyframeId,
    beginDrag,
    handleKeyframeClick,
    handleKeyframeContextMenu,
    justDraggedKeyframeRef,
    timelineMaxStep,
  } = cameraTimeline;

  const replayMaxStep = info ? info.nSteps - 1 : 0;
  const handleSeekFromClientX = useCallback((clientX: number) => {
    if (!info || !timelineRef.current) return;
    const svgX = toSvgXFromClientX(clientX, timelineRef.current);
    const nextStep = toStepFromSvgX(svgX, replayMaxStep);
    void seek(nextStep);
  }, [info, replayMaxStep, seek, timelineRef]);

  const beginSeekAtClientX = useCallback((clientX: number) => {
    setIsSeeking(true);
    handleSeekFromClientX(clientX);
  }, [handleSeekFromClientX]);

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

  useEffect(() => {
    if (!isSeeking) return;

    const handleMove = (event: MouseEvent) => {
      handleSeekFromClientX(event.clientX);
    };

    const handleUp = () => {
      setIsSeeking(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [handleSeekFromClientX, isSeeking]);

  if (!info) return null;

  const replayMarkerLeftPercent =
    (toXFromStep(step, replayMaxStep) / TIMELINE_VIEWBOX_WIDTH) * 100;
  const replayMarkerTopPercent =
    (TIMELINE_BASELINE_Y / TIMELINE_VIEWBOX_HEIGHT) * 100;
  const keyframeMarkerTopPercent = (KEYFRAME_KNOB_Y / TIMELINE_VIEWBOX_HEIGHT) * 100;

  return (
    <div
      className={`absolute bottom-4 z-10 left-1/2 -translate-x-1/2 w-[80%] bg-gray-100 border border-gray-300 rounded-lg shadow-lg p-4 backdrop-blur-sm transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="space-y-3">
        <div className="relative">
          <svg
            ref={timelineRef}
            width="100%"
            viewBox={`0 0 ${TIMELINE_VIEWBOX_WIDTH} ${TIMELINE_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            className="w-full h-12 rounded border border-gray-200 bg-gray-50"
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <rect
              x={TIMELINE_PADDING_X}
              y={TIMELINE_INTERACTION_SPLIT_Y}
              width={TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X * 2}
              height={TIMELINE_VIEWBOX_HEIGHT - TIMELINE_INTERACTION_SPLIT_Y}
              fill="transparent"
              className="cursor-ew-resize"
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                beginSeekAtClientX(event.clientX);
              }}
            />

            <CameraTimelineLayer bindings={cameraTimeline} />

            <line
              x1={TIMELINE_PADDING_X}
              y1={TIMELINE_BASELINE_Y}
              x2={TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X}
              y2={TIMELINE_BASELINE_Y}
              stroke="#9ca3af"
              strokeWidth={1.5}
            />
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {keyframes.map((keyframe) => {
              const xPercent =
                (toXFromStep(keyframe.step, timelineMaxStep) / TIMELINE_VIEWBOX_WIDTH) * 100;
              const isActive = keyframe.id === activeKeyframeId;

              return (
                <div
                  key={keyframe.id}
                  className={`pointer-events-auto absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rotate-45 ${
                    isActive ? "cursor-ew-resize bg-blue-600" : "cursor-pointer bg-slate-700"
                  }`}
                  style={{
                    left: `${xPercent}%`,
                    top: `${keyframeMarkerTopPercent}%`,
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    event.preventDefault();
                    beginDrag({ type: "keyframe", id: keyframe.id, moved: false });
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (justDraggedKeyframeRef.current === keyframe.id) {
                      justDraggedKeyframeRef.current = null;
                      return;
                    }
                    handleKeyframeClick(keyframe.id);
                  }}
                  onContextMenu={(event) => handleKeyframeContextMenu(event, keyframe.id)}
                />
              );
            })}

            <div
              className="pointer-events-auto absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 cursor-ew-resize"
              style={{
                left: `${replayMarkerLeftPercent}%`,
                top: `${replayMarkerTopPercent}%`,
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                beginSeekAtClientX(event.clientX);
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
