import { useState } from "react";
import { useRef } from "react";
import { useThreeStore } from "../stores/ThreeStore";

import { StopCircleIcon } from "@heroicons/react/24/outline";

export default function CanvasRecorderPanel() {
  const [recording, setRecording] = useState(false);

  const gl = useThreeStore(s => s.gl);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = () => {
    if (!gl) return;
    setRecording(true);

    const stream = gl.domElement.captureStream(60);
    chunks.current = [];

    mediaRecorder.current = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
      videoBitsPerSecond: 50_000_000,
    });
    mediaRecorder.current.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.current.start();
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    setRecording(false);
  };

  return (
    <div>
      <h3 className="font-bold mb-2">Canvas Recorder</h3>
      {!recording ? 
      <button onClick={startRecording} className="h-6 w-10 grey-button flex justify-center items-center space-x-2">
        <svg className="w-3 h-3" viewBox="0 0 8 8" fill="red" xmlns="http://www.w3.org/2000/svg">
          <circle cx="4" cy="4" r="4" />
        </svg>
      </button>
      :
      <button onClick={stopRecording} className="h-6 w-10 grey-button flex justify-center items-center space-x-2">
        <StopCircleIcon className="w-4 h-auto" />
      </button>
      }
    </div>
  );
}
