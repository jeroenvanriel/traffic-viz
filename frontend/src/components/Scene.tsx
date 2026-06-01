import { useThreeStore } from "../stores/ThreeStore";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import CameraController from "./CameraController";
import Road, { type RoadData } from "./Road";
import VehicleMeshes from "./VehicleMeshes";
import { DEFAULT_LAYER_VISIBILITY, useRoadLayerStore } from "../stores/RoadLayerStore";

const EMPTY_ROAD_DATA: RoadData = {
  layers: {
    road: { kind: "polygon", polygons: [] },
    edge_markings: { kind: "polygon", polygons: [] },
    opposite_markings: { kind: "polygon", polygons: [] },
  },
  bounds: { minx: -50, miny: -50, maxx: 50, maxy: 50 },
};

export default function Scene({
  sceneId,
}: {
  sceneId: string;
}) {
  // store the three gl render context in a store
  // to access it later for recording the canvas to video
  const setGL = useThreeStore(s => s.setGL);
  const setAvailableLayers = useRoadLayerStore((s) => s.setAvailableLayers);
  const [roadData, setRoadData] = useState<RoadData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRoadData(null);

    fetch(`http://localhost:8000/api/scenes/${sceneId}/road`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const layers = (data.layers ?? EMPTY_ROAD_DATA.layers) as RoadData["layers"];
        const bounds = data.bounds ?? EMPTY_ROAD_DATA.bounds;
        setRoadData({ layers, bounds });
        setAvailableLayers(Object.keys(layers));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load road network", err);
        setRoadData(EMPTY_ROAD_DATA);
        setAvailableLayers(Object.keys(DEFAULT_LAYER_VISIBILITY));
      });

    return () => {
      cancelled = true;
    };
  }, [sceneId, setAvailableLayers]);

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
      <CameraController roadBounds={roadData?.bounds ?? null} />
      <Road roadData={roadData ?? EMPTY_ROAD_DATA} />
      <VehicleMeshes />
    </Canvas>
  )
}
