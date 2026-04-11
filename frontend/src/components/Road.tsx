import * as three from "three";

export type Point = { x: number; y: number; z?: number };

export type Path = Point[];

export type Polygon = {
  outer: Path;
  holes: Path[];
}

export type Bounds = { minx: number, miny: number, maxx: number, maxy: number };

export interface RoadData {
  polygons: Polygon[];
  markings: Polygon[];
  bounds: Bounds;
};

function Ground({ bounds }: { bounds: Bounds }) {
  const { minx, miny, maxx, maxy } = bounds;
  const sizex = maxx - minx;
  const sizey = maxy - miny;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} // rotate plane to lie flat
      position={[(maxx + minx) / 2, 0, (maxy + miny) / 2]}
    >
      <planeGeometry args={[sizex, sizey]} />
      {/* depthWrite={false} prevents z-fighting with road polygons */}
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

function RoadPolygons({ polygons }: { polygons: Polygon[] }) {
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
            position={[0, 0, 0]}
          >
            <meshStandardMaterial color="darkgrey" side={three.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

function MarkingPolygons({ markings }: { markings: Polygon[] | null }) {
  if (!markings) return null;

  return (
    <>
      {markings.map((poly, idx) => {
        const shape = polygonToShape(poly);
        const geometry = new three.ShapeGeometry(shape);

        return (
          <mesh
            key={idx}
            geometry={geometry}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
          >
            <meshStandardMaterial color="white" side={three.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

export default function Road({ roadData }: { roadData: RoadData }) {
  return (
    <>
      <Ground bounds={roadData.bounds} />
      <RoadPolygons polygons={roadData.polygons} />
      <MarkingPolygons markings={roadData.markings} />
    </>
  );
}
