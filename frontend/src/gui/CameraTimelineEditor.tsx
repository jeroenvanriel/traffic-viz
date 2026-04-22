import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Vector3 } from "three";

import { useCameraStore } from "../stores/CameraStore";
import { useKeyframeStore } from "../stores/KeyframeStore";
import type { CameraKeyframe, CameraSequence } from "../stores/KeyframeStore";
import { useNotifications } from "../components/NotificationSystem";
import {
  TIMELINE_BASELINE_Y,
  TIMELINE_INTERACTION_SPLIT_Y,
  TIMELINE_PADDING_X,
  TIMELINE_VIEWBOX_WIDTH,
  toSvgXFromClientX,
  toStepFromSvgX,
  toXFromStep,
} from "./timelineGeometry";

type DragState =
  | { type: "keyframe"; id: string; moved: boolean }
  | null;

const KEYFRAME_KNOB_Y = 22;
const KEYFRAME_TRACK_Y = TIMELINE_BASELINE_Y;
export { KEYFRAME_KNOB_Y };

export type CameraTimelineEditorBindings = {
  sequences: CameraSequence[];
  selectedSequence: CameraSequence | null;
  keyframes: CameraKeyframe[];
  activeKeyframeId: string | null;
  setCurrentSequence: (id: string | null) => void;
  addSequence: (name: string) => string;
  removeSequence: (id: string) => void;
  renameSequence: (id: string, name: string) => void;
  beginDrag: (next: DragState) => void;
  handleKeyframeClick: (keyframeId: string) => void;
  handleKeyframeContextMenu: (event: React.MouseEvent, keyframeId: string) => void;
  handleTimelineClick: (event: React.MouseEvent<SVGRectElement>) => void;
  justDraggedKeyframeRef: React.MutableRefObject<string | null>;
  timelineMaxStep: number;
};

function cloneVector(v: Vector3): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

export function useCameraTimelineEditor(
  maxStep: number,
  timelineSvgRef: React.RefObject<SVGSVGElement | null>
): CameraTimelineEditorBindings {
  const {
    sequences,
    addSequence,
    removeSequence,
    renameSequence,
    persistSequence,
    upsertKeyframe,
    updateKeyframePose,
    setKeyframeStep,
    removeKeyframe,
  } = useKeyframeStore();

  const {
    camera,
    controls,
    moveCamera,
    currentSequence,
    setCurrentSequence,
  } = useCameraStore();

  const { notify } = useNotifications();

  const [activeKeyframeId, setActiveKeyframeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);

  const persistTimeoutRef = useRef<number | null>(null);
  const justDraggedKeyframeRef = useRef<string | null>(null);

  const schedulePersist = (sequenceId: string) => {
    if (persistTimeoutRef.current !== null) {
      window.clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistSequence(sequenceId);
      persistTimeoutRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  const selectedSequence = currentSequence ? sequences.find((s) => s.id === currentSequence) ?? null : null;

  useEffect(() => {
    if (!selectedSequence) {
      setActiveKeyframeId(null);
      return;
    }

    if (!selectedSequence.keyframes.some((k) => k.id === activeKeyframeId)) {
      setActiveKeyframeId(null);
    }
  }, [selectedSequence, activeKeyframeId]);

  const keyframes = useMemo(
    () => [...(selectedSequence?.keyframes ?? [])].sort((a, b) => a.step - b.step),
    [selectedSequence]
  );

  const timelineMaxStep = useMemo(() => Math.max(1, maxStep), [maxStep]);

  const beginDrag = (next: DragState) => {
    setDragState(next);
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragState || !selectedSequence) return;

      if (dragState.type === "keyframe") {
        const svg = timelineSvgRef.current;
        if (!svg) return;

        const svgX = toSvgXFromClientX(event.clientX, svg);
        const nextStep = toStepFromSvgX(svgX, timelineMaxStep);
        setKeyframeStep(selectedSequence.id, dragState.id, nextStep, false);
        setDragState((prev) => (prev ? { ...prev, moved: true } : prev));
      }
    };

    const onMouseUp = () => {
      if (dragState?.moved && selectedSequence) {
        schedulePersist(selectedSequence.id);
        if (dragState.type === "keyframe") {
          justDraggedKeyframeRef.current = dragState.id;
        }
      }
      setDragState(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    dragState,
    selectedSequence,
    timelineMaxStep,
    timelineSvgRef,
    setKeyframeStep,
  ]);

  const handleKeyframeClick = (keyframeId: string) => {
    if (!selectedSequence) return;

    const keyframe = selectedSequence.keyframes.find((k) => k.id === keyframeId);
    if (!keyframe) return;

    if (activeKeyframeId === keyframeId) {
      if (!camera || !controls) return;

      updateKeyframePose(
        selectedSequence.id,
        keyframeId,
        cloneVector(camera.position),
        cloneVector(controls.target)
      );
      notify("Keyframe pose updated.", { tone: "success", durationMs: 1800 });
      return;
    }

    moveCamera(keyframe.position, keyframe.target);
    setActiveKeyframeId(keyframeId);
  };

  const handleTimelineClick = (event: React.MouseEvent<SVGRectElement>) => {
    if (!selectedSequence) return;
    if (!camera || !controls) return;

    event.stopPropagation();
    event.preventDefault();

    const svg = timelineSvgRef.current;
    if (!svg) return;

    const svgX = toSvgXFromClientX(event.clientX, svg);
    const step = toStepFromSvgX(svgX, timelineMaxStep);

    const id = nanoid();
    upsertKeyframe(selectedSequence.id, {
      id,
      position: cloneVector(camera.position),
      target: cloneVector(controls.target),
      step,
    });
    setActiveKeyframeId(id);
  };

  const handleKeyframeContextMenu = (event: React.MouseEvent, keyframeId: string) => {
    event.preventDefault();
    if (!selectedSequence) return;
    removeKeyframe(selectedSequence.id, keyframeId);
    notify("Keyframe removed.", { tone: "success", durationMs: 1800 });
  };

  return {
    sequences,
    selectedSequence,
    keyframes,
    activeKeyframeId,
    setCurrentSequence,
    addSequence,
    removeSequence,
    renameSequence,
    beginDrag,
    handleKeyframeClick,
    handleKeyframeContextMenu,
    handleTimelineClick,
    justDraggedKeyframeRef,
    timelineMaxStep,
  };
}

export function CameraTimelineLayer({
  bindings,
  markerRadiusX,
  markerRadiusY,
}: {
  bindings: CameraTimelineEditorBindings;
  markerRadiusX: number;
  markerRadiusY: number;
}) {
  const {
    keyframes,
    activeKeyframeId,
    beginDrag,
    handleKeyframeClick,
    handleKeyframeContextMenu,
    justDraggedKeyframeRef,
    handleTimelineClick,
    timelineMaxStep,
  } = bindings;

  return (
    <g>
      <rect
        x={TIMELINE_PADDING_X}
        y={0}
        width={TIMELINE_VIEWBOX_WIDTH - TIMELINE_PADDING_X * 2}
        height={TIMELINE_INTERACTION_SPLIT_Y}
        fill="transparent"
        className="cursor-crosshair"
        onClick={handleTimelineClick}
      />
      {keyframes.map((keyframe) => {
        const x = toXFromStep(keyframe.step, timelineMaxStep);
        const isActive = keyframe.id === activeKeyframeId;

        return (
          <g key={keyframe.id}>
            <line
              x1={x}
              y1={KEYFRAME_KNOB_Y}
              x2={x}
              y2={KEYFRAME_TRACK_Y}
              stroke={isActive ? "#2563eb" : "#9ca3af"}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <polygon
              points={`${x - markerRadiusX},${KEYFRAME_KNOB_Y - markerRadiusY*0.6} ${x + markerRadiusX},${KEYFRAME_KNOB_Y - markerRadiusY*0.6} ${x + markerRadiusX},${KEYFRAME_KNOB_Y} ${x},${KEYFRAME_KNOB_Y + markerRadiusY} ${x - markerRadiusX},${KEYFRAME_KNOB_Y}`}
              fill={isActive ? "#2563eb" : "#616161"}
              pointerEvents="none"
            />
            <ellipse
              cx={x}
              cy={KEYFRAME_KNOB_Y}
              rx={markerRadiusX}
              ry={markerRadiusY}
              fill="transparent"
              className={isActive ? "cursor-ew-resize" : "cursor-pointer"}
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
          </g>
        );
      })}
    </g>
  );
}
