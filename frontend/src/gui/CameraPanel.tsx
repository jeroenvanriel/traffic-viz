import { MapIcon } from "@heroicons/react/24/outline";

import { useCameraStore } from "../stores/CameraStore";
import { useNotifications } from "../components/NotificationSystem";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";

export default function SaveInitCameraButton() {
  const camera = useCameraStore(s => s.camera);
  const controls = useCameraStore(s => s.controls);
  const setInitCameraState = useSceneSettingsStore(s => s.setInitCameraState);
  const { notify } = useNotifications();

  const handleSave = async () => {
    // update the store's camera settings
    if (!camera) return;
    if (!controls) return;
    setInitCameraState(camera.position.clone(), controls.target.clone());
    notify("Initial camera updated.", { tone: "success", durationMs: 1600 });
  };

  return (
    <button
      onClick={handleSave}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 cursor-pointer"
      title="Save the current camera position and orientation and load it the next time this scene is loaded."
    >
      Set Initial Camera
    </button>
  );
}

export function TopDownCameraButton() {
  const orientTopDown = useCameraStore((s) => s.orientTopDown);
  const camera = useCameraStore((s) => s.camera);
  const controls = useCameraStore((s) => s.controls);

  return (
    <button
      type="button"
      onClick={orientTopDown}
      disabled={!camera || !controls}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      title="View the road from above with north at the top, like a map compass."
    >
      <MapIcon className="h-4 w-4" />
      Top-down north-up view
    </button>
  );
}
