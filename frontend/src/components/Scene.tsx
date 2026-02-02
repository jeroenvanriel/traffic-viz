import { useThreeStore } from "../stores/ThreeStore";
import { Canvas } from "@react-three/fiber";
import CameraController from "./CameraController";
import Road from "./Road";
import VehicleMeshes from "./VehicleMeshes";

export default function Scene({ sceneId }: { sceneId: string }) {
  // store the three gl render context in a store
  // to access it later for recording the canvas to video
  const setGL = useThreeStore(s => s.setGL);

  return (
    <Canvas
      camera={{ fov: 60 }}
      className="w-[1920px] h-[1080px]" // for video recording
      onCreated={({ gl }) => setGL(gl)} // for video recording
    >
      <ambientLight intensity={2.0} />
      <CameraController />
      <Road sceneId={sceneId} />
      <VehicleMeshes />
    </Canvas>
  )
}
