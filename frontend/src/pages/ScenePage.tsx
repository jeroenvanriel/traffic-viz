import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import Scene from "../components/Scene";
import SceneSidebar from "../gui/SceneSidebar.tsx";
import CanvasRecorderController from "../gui/CanvasRecorderController";
import ReplayPanel from "../gui/ReplayPanel.tsx";
import { useCameraTimelineEditor } from "../gui/CameraTimelineEditor";

import { useVehicleStore } from "../stores/VehicleStore";
import { useReplayController } from "../stores/ReplayController";
import { useKeyframeStore } from "../stores/KeyframeStore";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";
import { useRoadStore, usePolygonSelectionStore  } from "../stores/RoadStore.ts";
import { useVehicleTypeStore, useVehicleTypeSync } from "../stores/VehicleTypeStore";

function useSceneLoader(sceneId: string) {
  const loadRoadData = useRoadStore(s => s.load);
  const loadReplayMetadata = useReplayController((s) => s.load);
  const loadCameraSequences = useKeyframeStore((s) => s.loadSequences);
  const loadSceneSettings = useSceneSettingsStore((s) => s.loadSceneSettings);

  useEffect(() => {
    // clear old data
    useVehicleStore.getState().reset();
    useReplayController.getState().reset();
    useVehicleTypeStore.getState().reset();
    useRoadStore.getState().reset();
    usePolygonSelectionStore.getState().clearSelectedPolygon();

    loadRoadData(sceneId);
    loadReplayMetadata(sceneId);
    loadCameraSequences(sceneId);
    loadSceneSettings(sceneId);
  }, [sceneId]);
}

function useAutoHideUI(enabled: boolean) {
  const hideTimerRef = useRef<number | null>(null);
  const isMapInteractingRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 20);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMapInteractingRef.current) return;

      const sidebarZone = event.clientX <= 384;
      const timelineZone = window.innerHeight - event.clientY <= 120;

      if (sidebarZone || timelineZone) {
        setIsVisible(true);
        clearHideTimer();
      } else {
        scheduleHide();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const isCanvasTarget = target instanceof Element && target.closest("canvas");
      if (isCanvasTarget) {
        isMapInteractingRef.current = true;
      }
    };

    const handlePointerUp = () => {
      isMapInteractingRef.current = false;
    };

    if (!enabled) {
      clearHideTimer();
      setIsVisible(true);
      return;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      clearHideTimer();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [enabled]);

  return isVisible;
}

export default function ScenePage() {
  const { sceneId } = useParams();
  if (!sceneId) return null;

  const info = useReplayController((s) => s.info);
  const timelineRef = useRef<SVGSVGElement | null>(null);
  const replayMaxStep = info ? info.nSteps - 1 : 0;
  const cameraTimeline = useCameraTimelineEditor(replayMaxStep, timelineRef);

  useSceneLoader(sceneId);

  useVehicleTypeSync(sceneId);

  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const isUiVisible = useAutoHideUI(autoHideEnabled);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <CanvasRecorderController />
      <SceneSidebar
        sceneId={sceneId}
        cameraTimeline={cameraTimeline}
        autoHideEnabled={autoHideEnabled}
        onAutoHideEnabledChange={setAutoHideEnabled}
        isVisible={isUiVisible}
      />

      <div className="relative h-full w-full min-h-0 min-w-0">
        <ReplayPanel
          cameraTimeline={cameraTimeline}
          timelineRef={timelineRef}
          isVisible={isUiVisible}
        />
        <Scene />
      </div>
    </div>
  )
}
