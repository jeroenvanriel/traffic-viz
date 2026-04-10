import { useKeyframeStore, type CameraKeyframe, type CameraSequence } from "../stores/KeyframeStore";
import { useCameraStore } from "../stores/CameraStore";
import { nanoid } from "nanoid";

import { XMarkIcon, FolderPlusIcon, PlusCircleIcon } from "@heroicons/react/24/outline";

type KeyframeRowProps = {
  keyframe: CameraKeyframe;
  index: number;
  active?: boolean;
  onSelect: (kf: CameraKeyframe) => void;
  onDelete: (kf: CameraKeyframe) => void;
};

export function KeyframeRow({
  keyframe,
  index,
  active = false,
  onSelect,
  onDelete,
}: KeyframeRowProps) {
  return (
    <div className={`flex justify-between items-center w-full`}>
      <button
        onClick={() => onSelect(keyframe)}
        className={`
          flex-1
          click-button
          rounded h-6 text-xs!
          ${active ? "bg-gray-500" : "bg-gray-700 hover:bg-gray-600"}
        `}
      >
        <span>{`Keyframe ${index + 1}`}</span>
      </button>
      <button
        onClick={() => onDelete(keyframe)}
        className="ml-1 w-6 h-6 flex items-center justify-center rounded click-button bg-gray-700 hover:bg-gray-600"
        title="Delete keyframe"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

type SequenceRowProps = {
  sequence: CameraSequence,
  active?: boolean;
  onSelect: (seq: CameraSequence) => void,
  onDelete: (seq: CameraSequence) => void,
};

export function SequenceRow({
  sequence,
  active = false,
  onSelect,
  onDelete,
}: SequenceRowProps) {
  return (
    <div className={`flex justify-between items-center w-full`}>
      <button
        onClick={() => onSelect(sequence)}
        className={`
          flex-1
          click-button
          rounded h-6 text-xs!
          ${active ? "bg-gray-500" : "bg-gray-700 hover:bg-gray-600"}
        `}
      >
        <span>{sequence.name}</span>
      </button>
      <button
        onClick={() => onDelete(sequence)}
        className="ml-1 w-6 h-6 flex items-center justify-center rounded click-button bg-gray-700 hover:bg-gray-600"
        title="Delete keyframe"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CameraKeyframeManager() {
  const { sequences, addSequence, removeSequence, addKeyframe, removeKeyframe } = useKeyframeStore();
  const { camera, controls, moveCamera, currentSequence, setCurrentSequence, currentIndex, setCurrentIndex } = useCameraStore();

  const selectedSequence = sequences.find((s) => s.id === currentSequence);

  const handleAddKeyframe = () => {
    if (!currentSequence) return;
    if (!camera || !controls) return;
    const keyframe = {
      id: nanoid(),
      position: camera.position.clone(),
      target: controls.target.clone(),
      duration: 1,
    };
    addKeyframe(currentSequence, keyframe);
  };

  const handleApplyKeyframe = (keyframeId: string) => {
    if (!selectedSequence) return;
    const keyframe = selectedSequence.keyframes.find((p) => p.id === keyframeId);
    if (!keyframe) return;
    setCurrentIndex(selectedSequence.keyframes.indexOf(keyframe))
    moveCamera(keyframe.position, keyframe.target);
  };

  return (
    <>
      {/* Sequence Controls */}
      <div className="flex flex-col mb-2">
        <h4 className="my-2">Sequences</h4>
        <button className="mb-2 px-2 grey-button flex justify-center items-center space-x-2"
                onClick={() => setCurrentSequence(addSequence(`Sequence ${sequences.length + 1}`))}>
           <FolderPlusIcon className="w-4 h-4" />
           <span>Add Sequence</span>
        </button>
        <div className="flex flex-col space-y-1">
          {sequences.map((seq) => (
            <SequenceRow
              key={seq.id}
              sequence={seq}
              active={seq.id === currentSequence}
              onSelect={(seq) => setCurrentSequence(seq.id)}
              onDelete={(seq) => removeSequence(seq.id)}
            />
          ))}
        </div>
      </div>

      {/* Keyframes */}
      {selectedSequence && (
        <div className="flex flex-col">
          <h3 className="mb-2">Keyframes</h3>
          <button className="mb-2 px-2 grey-button flex justify-center items-center space-x-2"
                  onClick={handleAddKeyframe}>
            <PlusCircleIcon className="w-4 h-4" />
            <span>Save Current Camera</span>
          </button>
          <div className="space-y-1">
            {selectedSequence.keyframes.map((kf, idx) => (
              <KeyframeRow
                  key={kf.id}
                  keyframe={kf}
                  index={idx}
                  active={idx === currentIndex}
                  onSelect={(kf) => handleApplyKeyframe(kf.id)}
                  onDelete={(kf) => removeKeyframe(selectedSequence.id, kf.id)}
                />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
