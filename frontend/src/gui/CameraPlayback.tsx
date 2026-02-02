import { useCameraStore } from "../stores/CameraStore"

export default function CameraPlayback() {
  const startAnimation = useCameraStore(s => s.startAnimation);
  const stopAnimation = useCameraStore(s => s.stopAnimation);
  const isPlaying = useCameraStore(s => s.isPlaying);

  return (
    <div>
      <h4 className="my-2">Playback</h4>
      {isPlaying ? 
      <button className="w-18 grey-button"
        onClick={stopAnimation}
        title="Stop the current camera animation.">
          Stop
      </button>
      :
      <button className="w-18 grey-button"
        onClick={startAnimation}
        title="Start the current camera animation.">
          Start
      </button>
      }
    </div>
  )
}
