import { Deck, View, Viewport, PolygonLayer } from "deck.gl";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

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

type DeckPolygon = [number, number, number][][];

function toDeckPoint(point: Point): [number, number, number] {
  return [point.x, point.y, point.z ?? 0];
}

function closeRing(points: Point[]): [number, number, number][] {
  if (points.length === 0) {
    return [];
  }

  const ring = points.map(toDeckPoint);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (!first || !last) {
    return ring;
  }

  if (first[0] === last[0] && first[1] === last[1] && first[2] === last[2]) {
    return ring;
  }

  return [...ring, first];
}

function polygonToDeckPolygon(polygon: Polygon): DeckPolygon {
  return [closeRing(polygon.outer), ...polygon.holes.map(closeRing)].filter((ring) => ring.length >= 4);
}

function makeRoadLayerData(polygons: Polygon[]) {
  return polygons.map((polygon) => ({ polygon: polygonToDeckPolygon(polygon) }));
}

function getBoundsCenter(bounds: Bounds): [number, number, number] {
  return [
    (bounds.minx + bounds.maxx) / 2,
    (bounds.miny + bounds.maxy) / 2,
    0,
  ];
}

type ThreeViewState = {
  viewMatrix: number[];
  projectionMatrix: number[];
};

type ThreeViewProps = any;

export class ThreeView extends View<any, ThreeViewProps> {
  getViewportType() {
    return Viewport;
  }

  protected get ControllerType() {
    return null as any;
  }

  makeViewport({
    width,
    height,
    viewState
  }: {
    width: number;
    height: number;
    viewState: ThreeViewState;
  }) {
    return new Viewport({
      id: this.id,
      width,
      height,
      viewMatrix: viewState.viewMatrix,
      projectionMatrix: viewState.projectionMatrix
    });
  }
}

function createPolygonLayer(id: string, data: ReturnType<typeof makeRoadLayerData>, color: [number, number, number, number]) {
  return new PolygonLayer({
    id,
    data,
    getPolygon: (item: { polygon: DeckPolygon }) => item.polygon,
    getFillColor: color,
    stroked: false,
    filled: true,
    pickable: false,
    extruded: false,
    coordinateSystem: "cartesian",
  });
}

function RoadDeckOverlay({ roadData }: { roadData: RoadData }) {
  const deckRef = useRef<Deck<any> | null>(null);
  const { gl, size, camera } = useThree();

  const roadLayerData = useMemo(() => makeRoadLayerData(roadData.polygons), [roadData.polygons]);
  const markingLayerData = useMemo(() => makeRoadLayerData(roadData.markings), [roadData.markings]);
  const debugPointData = useMemo(
    () => [{ position: getBoundsCenter(roadData.bounds) }],
    [roadData.bounds]
  );

  const debugLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: "road-debug-point",
        data: debugPointData,
        getPosition: (item: { position: [number, number, number] }) => item.position,
        getFillColor: [255, 0, 0, 255],
        getRadius: 10,
        radiusUnits: "meters",
        stroked: false,
        pickable: true,
      }),
    [debugPointData]
  );

  const roadLayers = useMemo(() => {
    const layers: any[] = [debugLayer];

    if (roadLayerData.length || markingLayerData.length) {
      layers.push(
        createPolygonLayer("road-network-surface", roadLayerData, [140, 140, 140, 255]),
        createPolygonLayer("road-network-markings", markingLayerData, [245, 245, 245, 255])
      );
    }

    return layers;
  }, [debugLayer, markingLayerData, roadLayerData]);

  useEffect(() => {
    const deck = new Deck({
      gl: gl.getContext() as WebGL2RenderingContext,
      canvas: gl.domElement,
      views: new ThreeView({
        id: "three-view"
      }),
      controller: false,
      width: gl.domElement.width,
      height: gl.domElement.height,
      layers: roadLayers,
      // _animate: true,
      // _customRender: (redrawReason: string) => {
      //   gl.resetState();
      //   deck._drawLayers(redrawReason, { clearCanvas: false });
      //   gl.resetState();
      // },
      _customRender: (redrawReason: string) => { },
      _animate: false,
      parameters: {
        depthTest: true,
        depthMask: false,
        depthCompare: "less-equal"
      },
      useDevicePixels: gl.getPixelRatio(),
    } as any);

    deckRef.current = deck;

    deck.setProps({
      width: size.width,
      height: size.height,
      layers: roadLayers,
      viewState: {
        "three-view": getThreeViewState(camera)
      }
    } as any);

    return () => {
      deck.finalize();
      deckRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) {
      return;
    }

    deck.setProps({
      width: size.width,
      height: size.height,
      layers: roadLayers,
      viewState: {
        "three-view": getThreeViewState(camera)
      }
    } as any);
  }, [camera, roadLayers, size.height, size.width]);

  useFrame(() => {
    const deck = deckRef.current;
    if (!deck || !deck.isInitialized) {
      return;
    }

    gl.resetState();

    deck.setProps({
      viewState: {
        "three-view": getThreeViewState(camera)
      }
    } as any);

    deck._drawLayers("frame", { clearCanvas: false });

    gl.resetState();

  }, 0);

  return null;
}

export default function Road({ roadData }: { roadData: RoadData }) {
  return <RoadDeckOverlay roadData={roadData} />
}

function getThreeViewState(camera: any): ThreeViewState {
  camera.updateMatrixWorld(true);
  if (camera.parent) {
    camera.parent.updateMatrixWorld(true);
  }
  camera.updateProjectionMatrix();

  return {
    viewMatrix: camera.matrixWorldInverse.elements.slice(),
    projectionMatrix: camera.projectionMatrix.elements.slice()
  };
}

export function Ground() {
  return (
    <mesh
      rotation={[0, 0, 0]} // rotate plane to lie flat
      position={[0, 0, -10.05]}
      scale={[5000, 5000, 5000]}
      receiveShadow
    >
      <circleGeometry args={[1, 128]} />
      <meshStandardMaterial color="lightgreen" depthWrite={true} />
    </mesh>
  );
}