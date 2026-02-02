import * as three from "three";
import { useEffect, useState } from "react";

export type Point = { x: number; y: number; z?: number };

export type Polygon = Point[];

export type Bounds = { minx: number, miny: number, maxx: number, maxy: number };

export interface RoadData {
  polygons: Polygon[];
  bounds: Bounds;
};

function useRoadNetwork(sceneId?: string) {
  const [roadData, setRoadData] = useState<RoadData>({
    polygons: [],
    bounds: { minx: -50, miny: -50, maxx: 50, maxy: 50 },
  });

  useEffect(() => {
    if (!sceneId) return;

    fetch(`http://localhost:8000/scenes/${sceneId}/road`)
      .then(res => res.json())
      .then(data => setRoadData({ polygons: data.polygons, bounds: data.bounds }));
  }, [sceneId]);

  return roadData;
}

function Ground({ bounds }: { bounds: Bounds }) {
  const { minx, miny, maxx, maxy } = bounds;
  const sizex = maxx - minx;
  const sizey = maxy - miny;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} // rotate plane to lie flat
      position={[(maxx + minx) / 2, -0.1, (maxy + miny) / 2]}
    >
      <planeGeometry args={[sizex, sizey]} />
      <meshStandardMaterial color="lightgreen" />
    </mesh>
  );
}

function RoadPolygons({ polygons }: { polygons: Polygon[] }) {
  return (
    <>
      {polygons.map((poly, idx) => {
        // create a Shape for the polygon
        const shape = new three.Shape();
        poly.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x, p.y);
          else shape.lineTo(p.x, p.y);
        });
        shape.closePath();

        const geometry = new three.ShapeGeometry(shape);

        return (
          <mesh
            key={idx}
            geometry={geometry}
            rotation={[Math.PI / 2, 0, 0]} // lay flat on XZ-plane
            position={[0, 0, 0]}
          >
            <meshStandardMaterial color="darkgrey" side={three.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

export default function Road({ sceneId }: { sceneId: string }) {
  // fetch road bounds and polygons for this scene
  const roadData = useRoadNetwork(sceneId);

  return (
    <>
      <Ground bounds={roadData.bounds} />
      <RoadPolygons polygons={roadData.polygons} />
    </>
  );
}
