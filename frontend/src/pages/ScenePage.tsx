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

function resetAllReplayStores() {
  useVehicleStore.getState().reset();
  useReplayController.getState().reset();
}

export default function ScenePage() {
  const { sceneId } = useParams();
  if (!sceneId) return null;
  const load = useReplayController((s) => s.load);
  const info = useReplayController((s) => s.info);
  const loadSequences = useKeyframeStore((s) => s.loadSequences);
  const loadSceneSettings = useSceneSettingsStore((s) => s.loadSceneSettings);
  const timelineRef = useRef<SVGSVGElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isMapInteractingRef = useRef(false);
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const replayMaxStep = info ? info.nSteps - 1 : 0;
  const cameraTimeline = useCameraTimelineEditor(replayMaxStep, timelineRef);

  useEffect(() => {
    // clear old data
    resetAllReplayStores();

    // load replay metadata
    void load(sceneId);
    void loadSequences(sceneId);
    void loadSceneSettings(sceneId);
  }, [sceneId, load, loadSequences, loadSceneSettings]);

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
        setIsUiVisible(false);
      }, 20);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMapInteractingRef.current) {
        return;
      }

      const isInSidebarRevealZone = event.clientX <= 384;
      const isInTimelineRevealZone = window.innerHeight - event.clientY <= 120;
      if (isInSidebarRevealZone || isInTimelineRevealZone) {
        setIsUiVisible(true);
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

    if (!autoHideEnabled) {
      clearHideTimer();
      setIsUiVisible(true);
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
  }, [autoHideEnabled]);

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
        <Scene sceneId={sceneId} />
      </div>
    </div>
  )
}
