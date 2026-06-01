import * as three from "three";
import { Line } from "@react-three/drei";
import { useRoadLayerStore } from "../stores/RoadLayerStore";

export type Point = { x: number; y: number; z?: number };

export type Path = Point[];

export type Polygon = {
  outer: Path;
  holes: Path[];
}

export type Bounds = { minx: number, miny: number, maxx: number, maxy: number };

export type LayerKind = "polygon" | "path";

export interface RoadLayer {
  kind: LayerKind;
  polygons?: Polygon[];
  paths?: Path[];
}

export interface RoadData {
  layers: Record<string, RoadLayer>;
  bounds: Bounds;
};

type LayerStyle = {
  color: three.ColorRepresentation;
  yOffset: number;
  side?: three.Side;
};

const LAYER_STYLES: Record<string, LayerStyle> = {
  road: { color: "darkgrey", yOffset: 0, side: three.DoubleSide },
  edge_markings: { color: "white", yOffset: 0.01, side: three.DoubleSide },
  opposite_markings: { color: "#ffd84d", yOffset: 0.015, side: three.DoubleSide },
};

const FALLBACK_LAYER_STYLE: LayerStyle = {
  color: "white",
  yOffset: 0,
  side: three.DoubleSide,
};

function Ground() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} // rotate plane to lie flat
      position={[0, -0.05, 0]}
      scale={[5000, 5000, 5000]}
      receiveShadow
    >
      <circleGeometry args={[1, 128]} />
      <meshStandardMaterial color="lightgreen" depthWrite={false} />
    </mesh>
  );
}

function polygonToShape(polygon: Polygon) {
  const shape = new three.Shape();

  const outer = polygon.outer;
  shape.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) {
    shape.lineTo(outer[i].x, outer[i].y);
  }
  shape.closePath();

  // add holes
  polygon.holes.forEach(hole => {
    const path = new three.Path();
    path.moveTo(hole[0].x, hole[0].y);
    for (let i = 1; i < hole.length; i++) {
      path.lineTo(hole[i].x, hole[i].y);
    }
    path.closePath();
    shape.holes.push(path);
  });

  return shape;
}

function PolygonLayer({ polygons, style }: { polygons: Polygon[]; style: LayerStyle }) {
  return (
    <>
      {polygons.map((poly, idx) => {
        const shape = polygonToShape(poly);
        const geometry = new three.ShapeGeometry(shape);

        return (
          <mesh
            key={idx}
            geometry={geometry}
            rotation={[Math.PI / 2, 0, 0]} // lay flat on XZ-plane
            position={[0, style.yOffset, 0]}
            receiveShadow
          >
            <meshStandardMaterial color={style.color} side={style.side ?? three.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

function PathLayer({ paths, style }: { paths: Path[]; style: LayerStyle }) {
  return (
    <>
      {paths.map((path, idx) => {
        if (path.length < 2) return null;
        const points = path.map((p) => new three.Vector3(p.x, style.yOffset, p.y));

        return (
          <Line key={idx} points={points} color={style.color as string} />
        );
      })}
    </>
  );
}

function LayerRenderer({ layerId, layer }: { layerId: string; layer: RoadLayer }) {
  const style = LAYER_STYLES[layerId] ?? FALLBACK_LAYER_STYLE;

  if (layer.kind === "polygon") {
    return <PolygonLayer polygons={layer.polygons ?? []} style={style} />;
  }

  if (layer.kind === "path") {
    return <PathLayer paths={layer.paths ?? []} style={style} />;
  }

  return null;
}

export default function Road({
  roadData,
}: {
  roadData: RoadData;
}) {
  const layerVisibility = useRoadLayerStore((s) => s.layerVisibility);

  return (
    <>
      <Ground />
      {Object.entries(roadData.layers).map(([layerId, layer]) => {
        if (layerVisibility[layerId] === false) {
          return null;
        }

        return <LayerRenderer key={layerId} layerId={layerId} layer={layer} />;
      })}
    </>
  );
}
