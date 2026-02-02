import { useRef } from 'react';
import { Mesh, Vector3, Euler, Quaternion } from 'three';
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

export default function VehicleMeshes() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleMeshRefs = useRef<Record<string, Mesh>>({});

  const { tick } = useReplayController();
  const isPlaying = useReplayController((s) => s.isPlaying);

  // update vehicle positions every frame
  useFrame((_state, tDelta) => {
    Object.entries(vehicleMeshRefs.current).forEach(([id, mesh]) => {
      const v = vehicles[id];
      if (!v || !mesh) return;
      // interpolate to target position/orientation
      const { pos, quat } = getTarget(v);
      if (isPlaying) {
        mesh.position.lerp(pos, 0.1);
        mesh.quaternion.slerp(quat, 0.1);
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
        <mesh
          key={v.id}
          ref={(mesh) => {
            if (mesh) { vehicleMeshRefs.current[v.id] = mesh; }
            else delete vehicleMeshRefs.current[v.id]; // clean up when unmounted
          }}
          onUpdate={(mesh) => {
            // set position/orientation once when the mesh is first created
            const { pos, quat } = getTarget(v);
            mesh.position.copy(pos);
            mesh.quaternion.copy(quat);
          }}
        >
          <boxGeometry args={[vehicleWidth, vehicleHeight, vehicleLength]} />
          <meshStandardMaterial color="red" />
        </mesh>
      ))}
    </>
  );
}
