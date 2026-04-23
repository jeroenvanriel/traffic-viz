import { useEffect, useRef } from "react";
import { create } from "zustand";

import { useNotifications } from "../components/NotificationSystem";
import { useReplayController } from "../stores/ReplayController";
import { useThreeStore } from "../stores/ThreeStore";

type RecordingStartMode = "current" | "from-start";
const RECORD_FROM_START_PREROLL_MS = 250;

type CanvasRecorderStore = {
  isRecording: boolean;
  startMode: RecordingStartMode;
  startRecording: () => void;
  startRecordingFromStart: () => void;
  stopRecording: () => void;
};

export const useCanvasRecorderStore = create<CanvasRecorderStore>((set) => ({
  isRecording: false,
  startMode: "current",
  startRecording: () => set({ isRecording: true, startMode: "current" }),
  startRecordingFromStart: () => set({ isRecording: true, startMode: "from-start" }),
  stopRecording: () => set({ isRecording: false }),
}));

export default function CanvasRecorderController() {
  const isRecording = useCanvasRecorderStore((s) => s.isRecording);
  const startMode = useCanvasRecorderStore((s) => s.startMode);
  const stopRecording = useCanvasRecorderStore((s) => s.stopRecording);
  const gl = useThreeStore((s) => s.gl);
  const info = useReplayController((s) => s.info);
  const step = useReplayController((s) => s.step);
  const play = useReplayController((s) => s.play);
  const pause = useReplayController((s) => s.pause);
  const seek = useReplayController((s) => s.seek);
  const { showPersistentNotification, hidePersistentNotification } = useNotifications();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const wait = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

  useEffect(() => {
    if (!isRecording || !info) return;
    if (step >= info.nSteps - 1) {
      stopRecording();
    }
  }, [info, isRecording, step, stopRecording]);

  useEffect(() => {
    if (!isRecording) {
      hidePersistentNotification();
      pause();
      return;
    }

    if (!gl) {
      stopRecording();
      return;
    }

    let cancelled = false;

    const startRecorder = async () => {
      showPersistentNotification("Video recording...", {
        tone: "danger",
        actionLabel: "Stop",
        onAction: stopRecording,
      });

      if (startMode === "from-start") {
        await seek(0);
        if (cancelled || !useCanvasRecorderStore.getState().isRecording) {
          return;
        }

        await wait(RECORD_FROM_START_PREROLL_MS);
        if (cancelled || !useCanvasRecorderStore.getState().isRecording) {
          return;
        }
      }

      const stream = gl.domElement.captureStream(60);
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp9",
        videoBitsPerSecond: 50_000_000,
      });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "recording.webm";
        anchor.click();
        URL.revokeObjectURL(url);
        mediaRecorderRef.current = null;
        hidePersistentNotification();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      await play();
    };

    void startRecorder();

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [
    gl,
    hidePersistentNotification,
    isRecording,
    pause,
    play,
    seek,
    showPersistentNotification,
    startMode,
    stopRecording,
  ]);

  return null;
}