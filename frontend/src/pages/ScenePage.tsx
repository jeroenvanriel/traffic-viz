import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

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

  const [showSidebar, setShowSidebar] = useState(true);
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
      {showSidebar && (
      <div className="p-5 bg-gray-800 text-white">
        <div className="w-80 flex flex-col space-y-4">
          <Link to="/" className="mb-4 grey-link-button">
            <ArrowLeftIcon className="w-4 h-auto mr-2" />
            Home
          </Link>

          <CanvasRecorderPanel />
          <CameraPanel />
          <ReplayPanel />
          <BufferDebugList />
        </div>
      </div>
      )}

      {/* Main Area */}
      <div className="flex-1 relative">
        {/* Toggle Button */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-4 z-10 text-white bg-gray-800 p-2 rounded-tr-lg rounded-br-lg cursor-pointer"
        >
          {showSidebar ? <ChevronLeftIcon className="w-4 h-auto mr-1" /> : <ChevronRightIcon className="w-4 h-auto mr-1" />}
        </button>

        {/* Visualization */}
        <Scene sceneId={sceneId} />
      </div>

    </div>
  )
}
