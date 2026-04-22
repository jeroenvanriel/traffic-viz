import { StopCircleIcon } from "@heroicons/react/24/outline";
import { useThreeStore } from "../stores/ThreeStore";
import { useCanvasRecorderStore } from "./CanvasRecorderController";

export default function CanvasRecorderPanel() {
  const gl = useThreeStore(s => s.gl);
  const isRecording = useCanvasRecorderStore((s) => s.isRecording);
  const startRecording = useCanvasRecorderStore((s) => s.startRecording);
  const startRecordingFromStart = useCanvasRecorderStore((s) => s.startRecordingFromStart);
  const stopRecording = useCanvasRecorderStore((s) => s.stopRecording);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Video Recorder</h3>
      {!isRecording ? (
        <div className="space-y-2">
          <button
            onClick={startRecording}
            disabled={!gl}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 8 8" fill="red" xmlns="http://www.w3.org/2000/svg">
              <circle cx="4" cy="4" r="4" />
            </svg>
            Record from Here
          </button>

          <button
            onClick={startRecordingFromStart}
            disabled={!gl}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 8 8" fill="red" xmlns="http://www.w3.org/2000/svg">
              <circle cx="4" cy="4" r="4" />
            </svg>
            Record From Start
          </button>
        </div>
      ) : (
        <button onClick={stopRecording} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 cursor-pointer">
          <StopCircleIcon className="w-4 h-auto" />
          Stop Recording
        </button>
      )}
    </div>
  );
}
