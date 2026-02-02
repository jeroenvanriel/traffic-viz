import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useCameraStore } from "../stores/CameraStore";
import { useKeyframeStore } from "../stores/KeyframeStore";
import { Vector3 } from "three";

export default function CameraController() {
  const { setCameraRef, setControlsRef, moveCamera, setCurrentIndex } = useCameraStore();
  const { camera } = useThree();
  const controls = useRef<any | null>(null);

  // once on mount, store controls ref globally
  useEffect(() => {
    if (controls.current) {
      setControlsRef(controls.current);
    }
  }, []);

  // save global camera reference and set initial camera position
  const initKeyframe = useKeyframeStore(s => s.initKeyframe);
  useEffect(() => {
    setCameraRef(camera);
    const { position, target } = initKeyframe;
    moveCamera(position, target);
  }, [camera, initKeyframe])

  const { currentSequence, currentIndex, isPlaying } = useCameraStore();
  const sequences = useKeyframeStore(s => s.sequences);
  const keyframes = sequences.find((s) => s.id === currentSequence)?.keyframes;

  const timeRef = useRef(0);
  useFrame((_state, delta) => {
    if (!camera || !controls.current || !isPlaying || !keyframes || keyframes.length < 2) {
      if (controls.current) controls.current.update();
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
    <OrbitControls ref={controls} />
  )
}
