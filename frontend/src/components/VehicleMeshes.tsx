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

type Vec3 = [number, number, number];

type TransformConfig = {
  scale: Vec3;
  rotation: Vec3;
  offset: Vec3;
};

type VehicleTypeModel = {
  url: string;
  transform_config: TransformConfig;
};

type VehicleTypesResponse = Record<string, VehicleTypeModel>;

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
  const [modelByType, setModelByType] = useState<Record<string, VehicleTypeModel>>({});

  const { tick } = useReplayController();
  const isPlaying = useReplayController((s) => s.isPlaying);
  const replaySpeed = useReplayController((s) => s.replaySpeed);
  const interpolationAlpha = useReplayController((s) => s.interpolationAlpha);
  const info = useReplayController((s) => s.info);

  // load vehicle type -> model mapping and keep it synced across tabs
  useEffect(() => {
    let mounted = true;

    async function loadVehicleTypes() {
      try {
        const res = await fetch('http://localhost:8000/api/vehicle-types');
        if (!res.ok) return;

        const mapping: VehicleTypesResponse = await res.json();
        if (mounted) {
          setModelByType(mapping);
        }
      } catch {
        if (mounted) {
          setModelByType({});
        }
      }
    }

    function handleModelUpdateBroadcast(event: MessageEvent) {
      if (event.data?.type === 'model-transform-updated') {
        loadVehicleTypes();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadVehicleTypes();
      }
    }

    function handleWindowFocus() {
      loadVehicleTypes();
    }

    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('model-config-updates')
        : null;
    channel?.addEventListener('message', handleModelUpdateBroadcast);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    loadVehicleTypes();

    return () => {
      mounted = false;
      channel?.removeEventListener('message', handleModelUpdateBroadcast);
      channel?.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [info?.sceneId]);

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
              <mesh>
                <boxGeometry args={[vehicleWidth, vehicleHeight, vehicleLength]} />
                <meshStandardMaterial color="red" />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}
