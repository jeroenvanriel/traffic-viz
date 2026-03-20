import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { Vector3, Euler, Quaternion, Object3D } from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore, type VehicleState } from '../stores/VehicleStore';
import { useReplayController } from '../stores/ReplayController';

const vehicleWidth = 1;
const vehicleLength = 3;
const vehicleHeight = 1;

function getTarget(v: VehicleState) {
  // target position/orientation (offset half vehicle height)
  const targetPos = new Vector3(v.x, v.y + vehicleHeight / 2, v.z);
  const targetQuat = new Quaternion().setFromEuler(new Euler(0, v.r, 0));

  // direction vector = vehicle forward direction
  const forward = new Vector3(0, 0, 1);
  forward.applyEuler(new Euler(0, v.r, 0));   // rotate forward vector
  forward.multiplyScalar(vehicleLength / 2);  // (offset half vehicle length)
  targetPos.add(forward);

  return { pos: targetPos, quat: targetQuat };
}

type VehicleTypesResponse = Record<string, string>;

function VehicleModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clonedScene} />;
}

export default function VehicleMeshes() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleMeshRefs = useRef<Record<string, Object3D>>({});
  const [modelUrlByType, setModelUrlByType] = useState<Record<string, string>>({});

  const { tick } = useReplayController();
  const isPlaying = useReplayController((s) => s.isPlaying);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const info = useReplayController((s) => s.info);

  useEffect(() => {
    let cancelled = false;

    async function loadVehicleTypes() {
      try {
        const res = await fetch('http://localhost:8000/api/vehicle-types');
        if (!res.ok) return;

        const mapping: VehicleTypesResponse = await res.json();
        if (!cancelled) {
          setModelUrlByType(mapping);
        }
      } catch {
        if (!cancelled) {
          setModelUrlByType({});
        }
      }
    }

    loadVehicleTypes();

    return () => {
      cancelled = true;
    };
  }, [info?.sceneId]);

  useEffect(() => {
    if (!info?.vehicleTypes?.length) return;

    info.vehicleTypes.forEach((vehicleType) => {
      const modelUrl = modelUrlByType[vehicleType];
      if (modelUrl) {
        useGLTF.preload(modelUrl);
      }
    });
  }, [info?.vehicleTypes, modelUrlByType]);

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
      {Object.values(vehicles ?? {}).map((v) => (
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
          {modelUrlByType[v.type] ? (
            <VehicleModel modelUrl={modelUrlByType[v.type]} />
          ) : (
            <mesh>
              <boxGeometry args={[vehicleWidth, vehicleHeight, vehicleLength]} />
              <meshStandardMaterial color="red" />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}
