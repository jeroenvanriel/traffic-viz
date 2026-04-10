import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { useCameraStore } from "../stores/CameraStore";
import { useKeyframeStore } from "../stores/KeyframeStore";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";
import { Vector3 } from "three";

export default function CameraController() {
  const { setCameraRef, setControlsRef, moveCamera, setCurrentIndex } = useCameraStore();
  const { camera } = useThree();
  const controls = useRef<any | null>(null);

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
    const { position, target } = initCameraState;
    moveCamera(position, target);
  }, [camera, initCameraState])

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
