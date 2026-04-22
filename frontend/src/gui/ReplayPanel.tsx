import { useEffect, useState } from "react";
import { useCallback } from "react";
import type { RefObject } from "react";
import { useReplayController } from "../stores/ReplayController";
import { CameraTimelineLayer } from "./CameraTimelineEditor";
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
  const [timelinePixelSize, setTimelinePixelSize] = useState({
    width: TIMELINE_VIEWBOX_WIDTH,
    height: TIMELINE_VIEWBOX_HEIGHT,
  });

  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const seek = useReplayController((s) => s.seek);

  const { isPlaying, play, pause } = useReplayController();
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

  useEffect(() => {
    if (!info) return;

    const svg = timelineRef.current;
    if (!svg) return;
    const parent = svg.parentElement;

    const updateSize = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setTimelinePixelSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);
    if (parent) {
      observer.observe(parent);
    }
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [timelineRef, isVisible, info]);

  if (!info) return null;

  const hasSelectedSequence = cameraTimeline.selectedSequence !== null;
  const replayMarkerX = toXFromStep(step, replayMaxStep);
  const replayMarkerY = hasSelectedSequence ? TIMELINE_BASELINE_Y : TIMELINE_VIEWBOX_HEIGHT / 2;
  const seekRectY = hasSelectedSequence ? TIMELINE_INTERACTION_SPLIT_Y : 0;
  const seekRectHeight = hasSelectedSequence
    ? TIMELINE_VIEWBOX_HEIGHT - TIMELINE_INTERACTION_SPLIT_Y
    : TIMELINE_VIEWBOX_HEIGHT;
  const baselineY = hasSelectedSequence ? TIMELINE_BASELINE_Y : TIMELINE_VIEWBOX_HEIGHT / 2;
  const scaleX = timelinePixelSize.width / TIMELINE_VIEWBOX_WIDTH;
  const scaleY = timelinePixelSize.height / TIMELINE_VIEWBOX_HEIGHT;
  const markerPx = 5;
  const keyframeMarkerRadiusX = markerPx / Math.max(scaleX, 0.0001);
  const keyframeMarkerRadiusY = markerPx / Math.max(scaleY, 0.0001);
  const stepMarkerRadiusX = markerPx / Math.max(scaleX, 0.0001);
  const stepMarkerRadiusY = markerPx / Math.max(scaleY, 0.0001);

  return (
    <div
      className={`absolute bottom-4 z-10 left-1/2 -translate-x-1/2 w-[80%] bg-gray-100 border border-gray-300 rounded-lg shadow-lg p-2 backdrop-blur-sm transition-all duration-300 ${
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
            className={`w-full rounded border border-gray-200 bg-gray-50 ${hasSelectedSequence ? "h-12" : "h-8"}`}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {/** Camera timeline layer: keyframe markers */}
            {hasSelectedSequence && (
              <CameraTimelineLayer
                bindings={cameraTimeline}
                markerRadiusX={keyframeMarkerRadiusX}
                markerRadiusY={keyframeMarkerRadiusY}
              />
            )}

            {/** Base line */}
            <line
              x1={TIMELINE_PADDING_X}
              y1={baselineY}
              x2={TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X}
              y2={baselineY}
              stroke="#9ca3af"
              strokeWidth={1.5}
            />

            {/** Interaction layer for step seeking */}
            <rect
              x={TIMELINE_PADDING_X}
              y={seekRectY}
              width={TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X * 2}
              height={seekRectHeight}
              fill="transparent"
              className="cursor-ew-resize"
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                beginSeekAtClientX(event.clientX);
              }}
            />

            {/** Current step marker */}
            <ellipse
              cx={replayMarkerX}
              cy={replayMarkerY}
              rx={stepMarkerRadiusX}
              ry={stepMarkerRadiusY}
              fill="#2563eb"
              className="cursor-ew-resize"
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                beginSeekAtClientX(event.clientX);
              }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
