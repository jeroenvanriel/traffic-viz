import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CameraIcon,
  Cog6ToothIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

import PlaybackControls from "./PlaybackControls";
import CanvasRecorderPanel from "./CanvasRecorderPanel";
import SaveInitCameraButton from "./CameraPanel";
import { CameraSequenceList } from "../components/CameraSequenceList";
import type { CameraTimelineEditorBindings } from "./CameraTimelineEditor";

type SidebarTab = "playback" | "camera" | "settings";
const SIDEBAR_BOTTOM_INSET_PX = 130;
const MIN_SCROLLBAR_THUMB_HEIGHT_PX = 14;
const SCROLLBAR_TRACK_INSET_PX = 8;

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
    </button>
  );
}

export default function SceneSidebar({
  sceneId,
  cameraTimeline,
  autoHideEnabled,
  onAutoHideEnabledChange,
  isVisible,
}: {
  sceneId: string;
  cameraTimeline: CameraTimelineEditorBindings;
  autoHideEnabled: boolean;
  onAutoHideEnabledChange: (enabled: boolean) => void;
  isVisible: boolean;
}) {
  const sidebarMaxHeight = `calc(100vh - 1rem - ${SIDEBAR_BOTTOM_INSET_PX}px)`;
  const [activeTab, setActiveTab] = useState<SidebarTab>("playback");
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const [scrollbar, setScrollbar] = useState({
    visible: false,
    thumbHeight: MIN_SCROLLBAR_THUMB_HEIGHT_PX,
    thumbTop: 0,
  });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  const updateScrollbar = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setScrollbar({
        visible: false,
        thumbHeight: MIN_SCROLLBAR_THUMB_HEIGHT_PX,
        thumbTop: 0,
      });
      return;
    }

    const trackHeight = Math.max(1, clientHeight - SCROLLBAR_TRACK_INSET_PX * 2);
    const insetAwareVisibleHeight = trackHeight;
    const thumbHeight = Math.max(
      MIN_SCROLLBAR_THUMB_HEIGHT_PX,
      (insetAwareVisibleHeight / scrollHeight) * trackHeight
    );
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const scrollable = Math.max(1, scrollHeight - clientHeight);
    const thumbTop = (scrollTop / scrollable) * maxThumbTop;

    setScrollbar({
      visible: true,
      thumbHeight,
      thumbTop,
    });
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollbar();

    const onScroll = () => {
      updateScrollbar();
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      updateScrollbar();
    });
    observer.observe(el);
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    window.addEventListener("resize", updateScrollbar);

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      window.removeEventListener("resize", updateScrollbar);
    };
  }, [activeTab, isVisible]);

  useEffect(() => {
    if (!isDraggingScrollbar) return;

    const onMouseMove = (event: MouseEvent) => {
      const el = scrollContainerRef.current;
      if (!el) return;

      const trackHeight = Math.max(
        1,
        el.clientHeight - SCROLLBAR_TRACK_INSET_PX * 2
      );
      const maxThumbTop = Math.max(1, trackHeight - scrollbar.thumbHeight);
      const scrollable = Math.max(1, el.scrollHeight - el.clientHeight);
      const deltaY = event.clientY - dragStartYRef.current;
      const scrollDelta = (deltaY / maxThumbTop) * scrollable;
      el.scrollTop = dragStartScrollTopRef.current + scrollDelta;
    };

    const onMouseUp = () => {
      setIsDraggingScrollbar(false);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingScrollbar, scrollbar.thumbHeight]);

  return (
    <aside
      className={`absolute left-4 top-4 z-20 w-[22rem] rounded-xl border border-gray-200 bg-white shadow-lg transition-all duration-300 ${
        isVisible
          ? "opacity-100 translate-x-0 pointer-events-auto"
          : "opacity-0 -translate-x-4 pointer-events-none"
      }`}
      style={{ maxHeight: sidebarMaxHeight, overflow: "hidden" }}
    >
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto overflow-x-hidden scrollbar-none rounded-xl"
        style={{ maxHeight: sidebarMaxHeight }}
      >
        <div ref={contentRef} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Home
            </Link>
            <span className="text-xs font-semibold text-gray-400 mr-1">{sceneId}</span>
          </div>

          <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
            <div className="grid grid-cols-3 rounded-lg bg-gray-100 p-1">
              <TabButton
                active={activeTab === "playback"}
                label="Playback"
                icon={<PlayIcon className="h-5 w-5" />}
                onClick={() => setActiveTab("playback")}
              />
              <TabButton
                active={activeTab === "camera"}
                label="Camera"
                icon={<CameraIcon className="h-5 w-5" />}
                onClick={() => setActiveTab("camera")}
              />
              <TabButton
                active={activeTab === "settings"}
                label="Settings"
                icon={<Cog6ToothIcon className="h-5 w-5" />}
                onClick={() => setActiveTab("settings")}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4">
            {activeTab === "playback" && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <PlaybackControls />
              </section>
            )}

            {activeTab === "camera" && (
              <section className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <CameraSequenceList
                    sequences={cameraTimeline.sequences}
                    selectedSequenceId={cameraTimeline.selectedSequence?.id ?? null}
                    setCurrentSequence={cameraTimeline.setCurrentSequence}
                    addSequence={cameraTimeline.addSequence}
                    renameSequence={cameraTimeline.renameSequence}
                    removeSequence={cameraTimeline.removeSequence}
                  />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <CanvasRecorderPanel />
                </div>
              </section>
            )}

            {activeTab === "settings" && (
              <section className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Scene Settings</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoHideEnabled}
                        onChange={(e) => onAutoHideEnabledChange(e.target.checked)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      Auto-hide sidebar and timeline
                    </label>
                    <SaveInitCameraButton />
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {scrollbar.visible && (
        <div
          className="pointer-events-none absolute right-1 w-2"
          style={{
            top: `${SCROLLBAR_TRACK_INSET_PX}px`,
            bottom: `${SCROLLBAR_TRACK_INSET_PX}px`,
          }}
        >
          <div
            className="pointer-events-auto absolute w-[3px] rounded-full bg-slate-400/60 hover:bg-slate-500/75 cursor-pointer"
            style={{
              left: "50%",
              top: `${scrollbar.thumbTop}px`,
              height: `${scrollbar.thumbHeight}px`,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              const el = scrollContainerRef.current;
              if (!el) return;
              dragStartYRef.current = event.clientY;
              dragStartScrollTopRef.current = el.scrollTop;
              setIsDraggingScrollbar(true);
            }}
          />
        </div>
      )}
    </aside>
  );
}
