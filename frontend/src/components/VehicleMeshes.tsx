import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, DoubleSide, Euler, Object3D, Quaternion, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore, type VehicleState } from '../stores/VehicleStore';
import { useReplayController } from '../stores/ReplayController';
import { useVehicleTypeStore, type TransformConfig } from '../stores/VehicleTypeStore';

function getTarget(v: VehicleState) {
  // target position/orientation
  const targetPos = new Vector3(v.x, v.y, v.z);
  // additional rotation of 180deg to make +Z axis the model's forward direction,
  // necessary due to differences with SUMO's coordinate system
  const targetQuat = new Quaternion().setFromEuler(new Euler(0, v.r + Math.PI, 0));

  // direction vector = vehicle forward direction
  const forward = new Vector3(0, 0, 1);
  forward.applyEuler(new Euler(0, v.r, 0));   // rotate forward vector
  targetPos.add(forward);

  return { pos: targetPos, quat: targetQuat };
}

function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = "blur(10px)";
  context.fillStyle = "rgba(0, 0, 0, 0.35)";
  context.beginPath();
  context.roundRect(18, 30, 92, 68, 18);
  context.fill();

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function VehicleShadow({ size, position }: { size: [number, number]; position: [number, number, number] }) {
  const shadowTexture = useMemo(createShadowTexture, []);

  if (!shadowTexture) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      scale={[size[0], size[1], 1]}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={shadowTexture}
        transparent
        opacity={0.55}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function VehicleModel({ modelUrl, transformConfig }: { modelUrl: string; transformConfig: TransformConfig }) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Compute bounds after applying rotation and scale.
  const transformedBounds = useMemo(() => {
    const modelCopy = clonedScene.clone(true);
    modelCopy.rotation.set(...transformConfig.rotation);
    modelCopy.scale.set(...transformConfig.scale);
    modelCopy.updateMatrixWorld(true);

    const bounds = new Box3().setFromObject(modelCopy);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    return {
      size: [size.x, size.z] as [number, number],
      position: [center.x, bounds.min.y + 0.015, center.z] as [number, number, number],
    };
  }, [clonedScene, transformConfig.rotation, transformConfig.scale]);

  const shadowSize = useMemo(() => {
    return [transformedBounds.size[0] * 1.8, transformedBounds.size[1] * 1.8] as [number, number];
  }, [transformedBounds.size]);

  return (
    <group position={transformConfig.offset}>
      <VehicleShadow size={shadowSize} position={transformedBounds.position} />
      <primitive object={clonedScene} scale={transformConfig.scale} rotation={transformConfig.rotation} />
    </group>
  );
}

export default function VehicleMeshes() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleMeshRefs = useRef<Record<string, Object3D>>({});
  const modelByType = useVehicleTypeStore((s) => s.modelByType);

  const { tick } = useReplayController();
  const isPlaying = useReplayController((s) => s.isPlaying);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const skipVehicleInterpolation = useReplayController((s) => s.skipVehicleInterpolation);
  const info = useReplayController((s) => s.info);

  // preload GLTF models when vehicle types are loaded
  useEffect(() => {
    if (!info?.vehicleTypes?.length) return;

    info.vehicleTypes.forEach((vehicleType) => {
      const modelEntry = modelByType[vehicleType];
      if (modelEntry?.url) {
        useGLTF.preload(modelEntry.url);
      }
    });
  }, [info?.vehicleTypes, modelByType]);

  // update vehicle positions every frame
  useFrame((_state, tDelta) => {
    Object.entries(vehicleMeshRefs.current).forEach(([id, mesh]) => {
      const v = vehicles[id];
      if (!v || !mesh) return;
      // interpolate to target position/orientation
      const { pos, quat } = getTarget(v);
      if (isPlaying && !skipVehicleInterpolation) {
        mesh.position.lerp(pos, interpolationAlpha * replaySpeed);
        mesh.quaternion.slerp(quat, interpolationAlpha * replaySpeed);
      } else {
        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
      }
    });

    tick(tDelta); // load the next delta if playing
  });

  return (
    <>
      {Object.values(vehicles ?? {}).map((v) => {
        const modelEntry = modelByType[v.type];

        return (
          <group
            key={v.id}
            ref={(obj) => {
              if (obj) { vehicleMeshRefs.current[v.id] = obj; }
              else delete vehicleMeshRefs.current[v.id]; // clean up when unmounted
            }}
            onUpdate={(obj) => {
              // set position/orientation once when the mesh is first created
              const { pos, quat } = getTarget(v);
              obj.position.copy(pos);
              obj.quaternion.copy(quat);
            }}
          >
            {modelEntry?.url ? (
              <VehicleModel modelUrl={modelEntry.url} transformConfig={modelEntry.transform_config} />
            ) : (
              <group>
                <VehicleShadow size={[1.65, 4.2]} position={[0, 0.015, 0]} />
                <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
                  <boxGeometry args={[1.5, 1, 4]} />
                  <meshStandardMaterial color="red" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}
