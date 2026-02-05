import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

import Scene from "../components/Scene";
import CanvasRecorderPanel from "../gui/CanvasRecorderPanel";
import CameraPanel from "../gui/CameraPanel";
import ReplayPanel from "../gui/ReplayPanel";

import { useVehicleStore } from "../stores/VehicleStore";
import { useReplayController } from "../stores/ReplayController";
import BufferDebugList from "../gui/BufferDebugList";

function resetAllReplayStores() {
  useVehicleStore.getState().reset();
  useReplayController.getState().reset();
}

export default function ScenePage() {
  const { sceneId } = useParams();
  if (!sceneId) return null;

  const load = useReplayController((s) => s.load);

  useEffect(() => {
    // clear old data
    resetAllReplayStores();

    // load replay metadata
    load(sceneId)
  }, [sceneId]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <div className="p-5 bg-gray-800 text-white">
        <div className="w-80 flex flex-col space-y-4">
          <Link to="/" className="mb-4 grey-link-button">
            <ArrowLeftIcon className="w-4 h-auto mr-2" />
            Scene Overview
          </Link>

          <CanvasRecorderPanel />
          <CameraPanel />
          <ReplayPanel />
          <BufferDebugList />
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1">
        <Scene sceneId={sceneId} />
      </div>
    </div>
  )
}
