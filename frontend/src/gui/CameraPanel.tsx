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
