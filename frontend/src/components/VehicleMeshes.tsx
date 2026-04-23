import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { Vector3, Euler, Quaternion, Object3D } from 'three';
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

function VehicleModel({ modelUrl, transformConfig }: { modelUrl: string; transformConfig: TransformConfig }) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={clonedScene}
      scale={transformConfig.scale}
      rotation={transformConfig.rotation}
      position={transformConfig.offset}
    />
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
      if (isPlaying) {
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
              <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
                <boxGeometry args={[1.5, 1, 4]} />
                <meshStandardMaterial color="red" />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}
