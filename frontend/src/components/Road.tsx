import * as three from "three";
import { useRoadStore, usePolygonSelectionStore } from "../stores/RoadStore";
import type { RoadLayer, Polygon } from "../stores/RoadStore";

type LayerStyle = {
  color: three.ColorRepresentation;
  yOffset: number;
  side?: three.Side;
};

const LAYER_STYLES: Record<string, LayerStyle> = {
  lanes: { color: "darkgrey", yOffset: 0, side: three.DoubleSide },
  junctions: { color: "#6b7280", yOffset: 0, side: three.DoubleSide },
  edge_markings: { color: "white", yOffset: 0.01, side: three.DoubleSide },
  opposite_markings: { color: "#ffd84d", yOffset: 0.015, side: three.DoubleSide },
};

const FALLBACK_LAYER_STYLE: LayerStyle = {
  color: "white",
  yOffset: 0,
  side: three.DoubleSide,
};

function Ground() {
  const clearSelectedPolygon = usePolygonSelectionStore((s) => s.clearSelectedPolygon);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} // rotate plane to lie flat
      position={[0, -0.05, 0]}
      scale={[5000, 5000, 5000]}
      receiveShadow
      onClick={(event) => {
        if (event.delta > 2) return; // Only trigger click if it's not part of a drag (delta is the distance the mouse moved since the last click)
        clearSelectedPolygon();
      }}
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

function PolygonLayer({
  layerId,
  layer,
}: {
  layerId: string;
  layer: RoadLayer;
}) {
  const selectedPolygon = usePolygonSelectionStore((s) => s.selectedPolygon);
  const setSelectedPolygon = usePolygonSelectionStore((s) => s.setSelectedPolygon);
  const clearSelectedPolygon = usePolygonSelectionStore((s) => s.clearSelectedPolygon);

  const style = LAYER_STYLES[layerId] ?? FALLBACK_LAYER_STYLE;

  return (
    <>
      {layer.shapes?.map((shape, idx) => {
        const polygon = shape.polygon;
        const geometry = new three.ShapeGeometry(polygonToShape(polygon));
        const isSelected =
          selectedPolygon?.layerId === layerId && selectedPolygon.polygonIndex === idx;

        return (
          <mesh
            key={idx}
            geometry={geometry}
            rotation={[Math.PI / 2, 0, 0]} // lay flat on XZ-plane
            position={[0, style.yOffset, 0]}
            receiveShadow
            onClick={(event) => {
              // React Three Fiber click events are based on Three.js raycasting.
              if (event.delta > 2) return; // Only trigger click if it's not part of a drag (delta is the distance the mouse moved since the last click)
              event.stopPropagation();
              if (
                selectedPolygon?.layerId === layerId &&
                selectedPolygon.polygonIndex === idx
              ) {
                clearSelectedPolygon();
                return;
              }

              setSelectedPolygon({
                layerId: layerId,
                layerName: layer.name,
                polygonIndex: idx,
                metadata: shape.metadata ?? null,
              });
            }}
          >
            <meshStandardMaterial
              color={isSelected ? "#a855f7" : style.color}
              emissive={isSelected ? "#4c1d95" : "#000000"}
              side={style.side ?? three.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}


export default function Road() {
  const layers = useRoadStore(s => s.layers);
  const debugLayers = useRoadStore(s => s.debugLayers);
  const layerVisibility = useRoadStore(s => s.layerVisibility);

  return (
    <>
      <Ground />
      {Object.entries({...layers, ...debugLayers}).map(([layerId, layer]) => {
        if (layerVisibility[layerId] === false) {
          return null;
        }

        return (
          <PolygonLayer key={layerId} layerId={layerId} layer={layer} />
        );
      })}
    </>
  );
}
