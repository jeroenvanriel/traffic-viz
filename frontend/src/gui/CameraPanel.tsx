import CameraPlayback from "../gui/CameraPlayback";
import CameraKeyframeManager from "../gui/CameraKeyframeManager";

import { useCameraStore } from "../stores/CameraStore";
import { useKeyframeStore } from "../stores/KeyframeStore";

function SaveInitCameraButton() {
  const camera = useCameraStore(s => s.camera);
  const controls = useCameraStore(s => s.controls);
  const setInitKeyframe = useKeyframeStore(s => s.setInitKeyframe);

  const handleSave = async () => {
    // update the store's camera settings
    if (!camera) return;
    setInitKeyframe(camera.position.clone(), controls.target.clone());
  };

  return (
    <button
      onClick={handleSave}
      className="grey-button"
      title="Save the current camera position and orientation and load it the next time this scene is loaded."
    >
      Set Initial Camera
    </button>
  );
}

export default function CameraPanel() {
  return (
    <div>
      <h3 className="font-bold mb-2">Camera Manager</h3>
      <SaveInitCameraButton />
      <CameraPlayback />
      <CameraKeyframeManager />
    </div>
  );
}