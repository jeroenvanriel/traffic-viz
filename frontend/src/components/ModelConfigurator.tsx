import { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls} from '@react-three/drei';
import { DoubleSide, Group, MOUSE, Vector3, AxesHelper  } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { getModelBoundingBoxInfo } from '../utils/modelUtils';

type Vec3 = [number, number, number];

type TransformConfig = {
  scale: Vec3;
  rotation: Vec3;
  offset: Vec3;
};

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

interface ModelInfo {
  model_id: string;
  original_filename: string;
  stored_filename: string;
  type: string;
  added_at: string;
  transform_config: TransformConfig;
  thumbnail_filename: string | null;
  thumbnail_url: string | null;
}

/** Simple ground plane with road and directional arrow to indicate model orientation */
function Ground() {
  const size = 100;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="lightgreen" depthWrite={false} />
      </mesh>

      {/* Road */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 100]} />
        <meshStandardMaterial color="#6b7280" depthWrite={false} side={DoubleSide} />
      </mesh>

      {/* White direction arrow, indicating the model should face +Z */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.35, 6]} />
        <meshStandardMaterial color="#ffffff" side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 3.474]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <circleGeometry args={[0.95, 3]} />
        <meshStandardMaterial color="#ffffff" side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** Imported 3d model with transform controls */
function ConfigModel({
  modelUrl,
  initialConfig,
  onConfigChange,
  transformControls,
  orbitControlsRef,
}: {
  modelUrl: string;
  initialConfig: TransformConfig;
  onConfigChange: (config: TransformConfig) => void;
  transformControls: TransformControls | null;
  orbitControlsRef: React.MutableRefObject<any>;
}) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const modelGroupRef = useRef<Group>(null);

  // Setup TransformControls attachment and event listeners (stable effect)
  useEffect(() => {
    if (!modelGroupRef.current || !transformControls) return;

    transformControls.attach(modelGroupRef.current);

    // Handle transform changes
    const handleChange = () => {
      if (!modelGroupRef.current) return;

      const scale = [
        modelGroupRef.current.scale.x,
        modelGroupRef.current.scale.y,
        modelGroupRef.current.scale.z,
      ] as Vec3;

      const rotation = [
        modelGroupRef.current.rotation.x,
        modelGroupRef.current.rotation.y,
        modelGroupRef.current.rotation.z,
      ] as Vec3;

      const offset = [
        modelGroupRef.current.position.x,
        modelGroupRef.current.position.y,
        modelGroupRef.current.position.z,
      ] as Vec3;

      onConfigChange({ scale, rotation, offset });
    };

    const handleMouseDown = () => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = false;
      }
    };

    const handleMouseUp = () => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = true;
      }
    };

    transformControls.addEventListener('change', handleChange);
    transformControls.addEventListener('mouseDown', handleMouseDown);
    transformControls.addEventListener('mouseUp', handleMouseUp);

    return () => {
      transformControls.removeEventListener('change', handleChange);
      transformControls.removeEventListener('mouseDown', handleMouseDown);
      transformControls.removeEventListener('mouseUp', handleMouseUp);
      transformControls.detach();
    };
  }, [transformControls, onConfigChange, orbitControlsRef]);

  // Update gizmo position based on model configuration
  useEffect(() => {
    if (!modelGroupRef.current || !transformControls) return;

    const bbInfo = getModelBoundingBoxInfo(modelGroupRef.current);
    const helper = transformControls.getHelper();
    
    // Subtract offset from center to get the true geometric center
    const centerWithoutOffset = bbInfo.center.clone().sub(new Vector3(...initialConfig.offset));
    helper.position.copy(centerWithoutOffset);
  }, [transformControls, initialConfig]);

  return (
    <>
      <group
        ref={modelGroupRef}
        scale={initialConfig.scale}
        rotation={initialConfig.rotation}
        position={initialConfig.offset}
      >
        <primitive object={clonedScene} />
      </group>
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault={false}
        mouseButtons={{
          /* Swap left/right mouse buttons to align with MapControls */
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.ROTATE,
        }}
      />
    </>
  );
}

/** Scene wrapper component that manages TransformControls */
function ConfigSceneContent({
  model,
  transformConfig,
  onConfigChange,
  transformMode,
}: {
  model: ModelInfo;
  transformConfig: TransformConfig;
  onConfigChange: (config: TransformConfig) => void;
  transformMode: TransformMode;
}) {
  const { camera, gl, scene } = useThree();
  const transformControlsRef = useRef<TransformControls | null>(null);
  const orbitControlsRef = useRef<any>(null);

  // Initialize TransformControls in the scene context
  useEffect(() => {
    if (!camera || !gl.domElement) return;

    const controls = new TransformControls(camera, gl.domElement);
    controls.setSize(1.5);
    controls.setSpace('local');

    transformControlsRef.current = controls;

    // Add the helper (visual gizmo) to the scene
    const helper = controls.getHelper();
    helper.visible = false;
    scene.add(helper);

    return () => {
      scene.remove(helper);
      controls.dispose();
    };
  }, [camera, gl, scene]);

  // Update mode when it changes
  useEffect(() => {
    if (!transformControlsRef.current) return;

    const controls = transformControlsRef.current;
    const helper = controls.getHelper();

    if (transformMode === null) {
      controls.enabled = false;
      helper.visible = false;
      return;
    } else {
      controls.enabled = true;
      helper.visible = true;
    }

    controls.setMode(transformMode);
  }, [transformMode, transformControlsRef.current]);

  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight intensity={0.8} position={[5, 10, 7.5]} />

      <Ground />

      <ConfigModel
        modelUrl={`http://localhost:8000/model-files/${model.stored_filename}`}
        initialConfig={transformConfig}
        onConfigChange={onConfigChange}
        transformControls={transformControlsRef.current}
        orbitControlsRef={orbitControlsRef}
      />
    </>
  );
}

interface ModelConfiguratorProps {
  model: ModelInfo;
  onBackToLibrary: () => void;
}
export default function ModelConfigurator({ model, onBackToLibrary }: ModelConfiguratorProps) {
  const [transformConfig, setTransformConfig] = useState<TransformConfig>(model.transform_config);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>(null);

  // Keyboard shortcuts for mode switching and saving
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingInField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isTypingInField) return;

      const key = event.key.toLowerCase();
      if (key === 't') {
        setTransformMode((prev) => (prev === 'translate' ? null : 'translate'));
      } else if (key === 'r') {
        setTransformMode((prev) => (prev === 'rotate' ? null : 'rotate'));
      } else if (key === 's') {
        setTransformMode((prev) => (prev === 'scale' ? null : 'scale'));
      } else if (event.code === 'Space') {
        event.preventDefault();
        void handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave]);

  // Save updated transform config to backend and notify other tabs
  async function handleSave() {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8000/api/models/${model.model_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transform_config: transformConfig,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save model configuration');
      }

      // Broadcast update to other tabs so they can refresh their model data if needed
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('model-config-updates');
        channel.postMessage({
          type: 'model-transform-updated',
          modelId: model.model_id,
          timestamp: Date.now(),
        });
        channel.close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }

  function Axes({ size = 5 }) {
    return <primitive object={new AxesHelper(size)} />
  }

  return (
    <div className="relative w-full h-screen">
      {/* Fullscreen 3D Canvas */}
      <Canvas className="absolute inset-0" camera={{ position: [5, 5, 5], fov: 50 }}>
        <ConfigSceneContent
          model={model}
          transformConfig={transformConfig}
          onConfigChange={setTransformConfig}
          transformMode={transformMode}
        />
        <Axes />
      </Canvas>

      {/* Floating Control Panel */}
      <div className="absolute top-4 left-4 max-w-xl mx-auto bg-gray-100 border border-gray-300 rounded-lg shadow-lg p-4 backdrop-blur-sm">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">
            Configuring: {model.type || model.original_filename}
          </h3>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Mode selector buttons */}
          <div className="flex gap-2">
            {(['translate', 'rotate', 'scale'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTransformMode((prev) => (prev === mode ? null : mode))}
                className={`px-4 py-2 rounded text-sm font-medium transition cursor-pointer ${
                  transformMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                }`}
              >
                {mode === 'translate'
                  ? 'Move (T)'
                  : mode === 'rotate'
                    ? 'Rotate (R)'
                    : 'Scale (S)'}
              </button>
            ))}
          </div>

          {/* Display current transform values */}
          <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Scale</p>
              <p className="font-mono">[{transformConfig.scale.map(v => v.toFixed(2)).join(', ')}]</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Rotation (rad)</p>
              <p className="font-mono">[{transformConfig.rotation.map(v => v.toFixed(2)).join(', ')}]</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Offset</p>
              <p className="font-mono">[{transformConfig.offset.map(v => v.toFixed(2)).join(', ')}]</p>
            </div>
          </div>

          <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
            Press <strong>T</strong> to translate, <strong>R</strong> to rotate, <strong>S</strong> to scale, or <strong>SPC</strong> to save configuration.
            Drag the gizmo axes to transform the model.
            Position the vehicle on the road, with the arrow indicating the front facing direction. To assist with alignment, it is recommended 
            to keep a simulation running in another window to see how the model's position and orientation affect the replay.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onBackToLibrary}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 font-medium cursor-pointer"
            >
              Back to Library
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 font-medium cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Configuration (SPC)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
