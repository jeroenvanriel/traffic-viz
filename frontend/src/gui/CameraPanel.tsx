import CameraKeyframeManager from "../gui/CameraKeyframeManager";

import { useCameraStore } from "../stores/CameraStore";
import { useSceneSettingsStore } from "../stores/SceneSettingsStore";

function SaveInitCameraButton() {
  const camera = useCameraStore(s => s.camera);
  const controls = useCameraStore(s => s.controls);
  const setInitCameraState = useSceneSettingsStore(s => s.setInitCameraState);

  const handleSave = async () => {
    // update the store's camera settings
    if (!camera) return;
    if (!controls) return;
    setInitCameraState(camera.position.clone(), controls.target.clone());
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

function CameraPlaybackButton() {
  const startAnimation = useCameraStore(s => s.startAnimation);
  const stopAnimation = useCameraStore(s => s.stopAnimation);
  const isPlaying = useCameraStore(s => s.isPlaying);

  return (
    <div>
      <h4 className="my-2">Playback</h4>
      {isPlaying ? (
        <button
          className="w-18 grey-button"
          onClick={stopAnimation}
          title="Stop the current camera animation."
        >
          Stop
        </button>
      ) : (
        <button
          className="w-18 grey-button"
          onClick={startAnimation}
          title="Start the current camera animation."
        >
          Start
        </button>
      )}
    </div>
  );
}

export default function CameraPanel() {
  return (
    <div>
      <h3 className="font-bold mb-2">Camera Manager</h3>
      <SaveInitCameraButton />
      <CameraPlaybackButton />
      <CameraKeyframeManager />
    </div>
  );
}