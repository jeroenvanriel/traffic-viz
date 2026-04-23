import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useCameraStore } from "../stores/CameraStore";
import { type CameraKeyframe, useKeyframeStore } from "../stores/KeyframeStore";
import { useReplayController } from "../stores/ReplayController";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { Bounds } from "./Road";

const CAMERA_STEP_LERP_ALPHA = 0.2;

function computeCornerView(bounds: Bounds, fovDeg: number): { position: Vector3; target: Vector3 } {
  const centerX = (bounds.minx + bounds.maxx) / 2;
  const centerZ = (bounds.miny + bounds.maxy) / 2;
  const maxDimension = Math.max(bounds.maxx - bounds.minx, bounds.maxy - bounds.miny);
  const fovRad = (fovDeg * Math.PI) / 180;
  const distance = ((maxDimension / 2) / Math.tan(fovRad / 2)) * 1.35;

  return {
    position: new Vector3(centerX - distance * 0.9, Math.max(distance * 0.85, 18), centerZ - distance * 0.9),
    target: new Vector3(centerX, 0, centerZ),
  };
}

export default function CameraController({ roadBounds }: { roadBounds: Bounds | null }) {
  const { setCameraRef, setControlsRef, moveCamera, currentSequence } = useCameraStore();
  const { camera } = useThree();
  const controls = useRef<any | null>(null);
  const autoInitAttemptedRef = useRef(false);

  // camera settings
  useEffect(() => {
      camera.near = 0.5;
      camera.far = 100000;
      camera.updateProjectionMatrix();
    }, [camera]);

  // once on mount, store controls ref globally
  useEffect(() => {
    if (controls.current) {
      setControlsRef(controls.current);
    }
  }, []);

  // save global camera reference and set initial camera position
  const initCameraState = useSceneSettingsStore(s => s.initCameraState);
  useEffect(() => {
    setCameraRef(camera);
    if (!initCameraState) return;
    const { position, target } = initCameraState;
    moveCamera(position, target);
  }, [camera, initCameraState])

  const currentSceneId = useSceneSettingsStore((s) => s.currentSceneId);
  const setInitCameraState = useSceneSettingsStore((s) => s.setInitCameraState);

  useEffect(() => {
    autoInitAttemptedRef.current = false;
  }, [currentSceneId]);

  // If no user initial camera exists yet, compute a corner view that frames the whole road plane and persist it.
  useEffect(() => {
    if (!camera || !currentSceneId || !roadBounds || initCameraState || autoInitAttemptedRef.current) return;
    autoInitAttemptedRef.current = true;

    const bootstrapInitialCamera = async () => {
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 60;
      const { position, target } = computeCornerView(roadBounds, fov);
      setInitCameraState(position, target);
      moveCamera(position, target);
    };

    void bootstrapInitialCamera().catch((err) => {
      autoInitAttemptedRef.current = false;
      console.error("Failed to auto-compute initial camera", err);
    });
  }, [camera, currentSceneId, roadBounds, initCameraState, moveCamera, setInitCameraState]);

  const sequences = useKeyframeStore(s => s.sequences);
  const replayStep = useReplayController((s) => s.step);
  const replayIsPlaying = useReplayController((s) => s.isPlaying);

  const selectedSequence = currentSequence
    ? sequences.find((s) => s.id === currentSequence) ?? null
    : null;
  const interpolationType = selectedSequence?.interpolationType ?? "linear";
  const keyframes = [...(selectedSequence?.keyframes ?? [])].sort((a, b) => a.step - b.step);
  const minHeight = 0.5;

  // Keep the camera from tilting below the horizon to avoid ground crossing and stuttery clamp behavior.
  useEffect(() => {
    if (!controls.current) return;

    controls.current.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.current.minPolarAngle = 0;
    controls.current.target.y = Math.max(controls.current.target.y, minHeight);
  }, []);

  const lastAppliedStepRef = useRef<number | null>(null);
  const smoothStepRef = useRef(0);

  const interpolateKeyframes = (from: CameraKeyframe, to: CameraKeyframe, t: number) => {
    camera.position.lerpVectors(from.position, to.position, t);
    camera.updateMatrix();
    const currentTarget = new Vector3().lerpVectors(from.target, to.target, t);
    currentTarget.y = Math.max(currentTarget.y, minHeight);
    controls.current.target.copy(currentTarget);
    controls.current.update();
  };

  const applyKeyframePose = (keyframe: CameraKeyframe) => {
    camera.position.copy(keyframe.position);
    camera.updateMatrix();

    const clampedTarget = new Vector3().copy(keyframe.target);
    clampedTarget.y = Math.max(clampedTarget.y, minHeight);
    controls.current.target.copy(clampedTarget);
    controls.current.update();
  };

  const applyPoseForTimelineStep = (timelineStep: number): void => {
    if (!keyframes.length || !controls.current) return;

    if (interpolationType === "catmull_rom" && keyframes.length > 1) {
      const first = keyframes[0];
      const last = keyframes[keyframes.length - 1];

      if (timelineStep <= first.step) {
        applyKeyframePose(first);
        return;
      }

      if (timelineStep >= last.step) {
        applyKeyframePose(last);
        return;
      }

      const stepRange = Math.max(1, last.step - first.step);
      const t = MathUtils.clamp((timelineStep - first.step) / stepRange, 0, 1);

      // Spline is built from the full keyframe set so interpolation remains globally smooth.
      const positionCurve = new CatmullRomCurve3(keyframes.map((k) => k.position.clone()));
      const targetCurve = new CatmullRomCurve3(keyframes.map((k) => k.target.clone()));

      camera.position.copy(positionCurve.getPoint(t));
      camera.updateMatrix();

      const splineTarget = targetCurve.getPoint(t);
      splineTarget.y = Math.max(splineTarget.y, minHeight);
      controls.current.target.copy(splineTarget);
      controls.current.update();
      return;
    }

    const first = keyframes[0];
    if (timelineStep <= first.step) {
      applyKeyframePose(first);
      return;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const from = keyframes[i];
      const to = keyframes[i + 1];
      if (!from || !to) continue;

      const travelStart = from.step;
      const travelEnd = Math.max(to.step, travelStart + 1);
      if (timelineStep <= travelEnd) {
        const t = (timelineStep - travelStart) / (travelEnd - travelStart);
        interpolateKeyframes(from, to, Math.min(Math.max(t, 0), 1));
        return;
      }
    }

    const last = keyframes[keyframes.length - 1];
    applyKeyframePose(last);
  };

  useFrame(() => {
    if (!camera || !controls.current) {
      return;
    }

    if (keyframes.length === 0) {
      if (controls.current) {
        controls.current.update();
      }
      return
    }

    // While replay is playing, smooth between discrete replay step updates.
    if (replayIsPlaying) {
      const targetStep = replayStep;

      // Snap immediately on rewinds/seek-back to avoid trailing behind the slider.
      if (targetStep < smoothStepRef.current) {
        smoothStepRef.current = targetStep;
      } else {
        smoothStepRef.current = MathUtils.lerp(
          smoothStepRef.current,
          targetStep,
          CAMERA_STEP_LERP_ALPHA
        );
      }

      applyPoseForTimelineStep(smoothStepRef.current);
      lastAppliedStepRef.current = replayStep;
      return;
    }

    // While paused, only snap camera when step changed (e.g. user seek),
    // otherwise keep manual camera edits untouched.
    if (lastAppliedStepRef.current !== replayStep) {
      smoothStepRef.current = replayStep;
      applyPoseForTimelineStep(replayStep);
      lastAppliedStepRef.current = replayStep;
      return;
    }

    controls.current.update();
  });

  return (
    <MapControls ref={controls} />
  )
}
