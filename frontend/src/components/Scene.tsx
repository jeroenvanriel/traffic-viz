import { useThreeStore } from "../stores/ThreeStore";
import { Canvas } from "@react-three/fiber";
import CameraController from "./CameraController";
import Road from "./Road";
import VehicleMeshes from "./VehicleMeshes";

export default function Scene() {
  // store the three gl render context in a store
  // to access it later for recording the canvas to video
  const setGL = useThreeStore(s => s.setGL);

  return (
    <Canvas
      camera={{ fov: 60 }}
      className="w-[1920px] h-[1080px]" // for video recording
      onCreated={({ gl }) => setGL(gl)} // for video recording
    >
      <color attach="background" args={["#cef1ff"]} />
      <hemisphereLight
        intensity={0.9}
        color="#dff4ff"
        groundColor="#b8c39a"
      />
      <directionalLight
        position={[120, 180, 80]}
        intensity={0.5}
        color="#fff6e6"
      />
      <ambientLight intensity={0.7} />
      <CameraController />
      <Road />
      <VehicleMeshes />
    </Canvas>
  )
}
