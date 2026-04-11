import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useCameraStore } from "../stores/CameraStore";
import { useKeyframeStore } from "../stores/KeyframeStore";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";
import { PerspectiveCamera, Vector3 } from "three";
import type { Bounds } from "./Road";

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
  const { setCameraRef, setControlsRef, moveCamera, setCurrentIndex } = useCameraStore();
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

  const { currentSequence, currentIndex, isPlaying } = useCameraStore();
  const sequences = useKeyframeStore(s => s.sequences);
  const keyframes = sequences.find((s) => s.id === currentSequence)?.keyframes;
  const minHeight = 0.5;

  // Keep the camera from tilting below the horizon to avoid ground crossing and stuttery clamp behavior.
  useEffect(() => {
    if (!controls.current) return;

    controls.current.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.current.minPolarAngle = 0;
    controls.current.target.y = Math.max(controls.current.target.y, minHeight);
  }, []);

  const timeRef = useRef(0);
  useFrame((_state, delta) => {
    if (!camera || !controls.current || !isPlaying || !keyframes || keyframes.length < 2) {
      if (controls.current) {
        controls.current.update();
      }
      return
    }

    if (currentIndex >= keyframes.length - 1) {
      useCameraStore.getState().stopAnimation();
    }

    const from = keyframes[currentIndex];
    const to = keyframes[currentIndex + 1];
    if (!from || !to) return;

    timeRef.current += delta;
    const t = Math.min(timeRef.current / from.duration, 1);

    // interpolate position/target
    camera.position.lerpVectors(from.position, to.position, t);
    camera.updateMatrix();
    const currentTarget = new Vector3().lerpVectors(from.target, to.target, t);
    currentTarget.y = Math.max(currentTarget.y, minHeight);
    controls.current.target.copy(currentTarget);
    controls.current.update();

    // advance keyframe when done
    if (t >= 1) {
      timeRef.current = 0;
      if (currentIndex < keyframes.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        useCameraStore.getState().stopAnimation();
      }
    }
  });

  return (
    <MapControls ref={controls} />
  )
}
