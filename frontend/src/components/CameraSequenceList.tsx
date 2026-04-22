import { useState } from "react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { CameraSequence } from "../stores/KeyframeStore";
import { useConfirmation } from "./ConfirmationModal";

type CameraSequenceListProps = {
  sequences: CameraSequence[];
  selectedSequenceId: string | null;
  setCurrentSequence: (id: string | null) => void;
  addSequence: (name: string) => string;
  renameSequence: (id: string, name: string) => void;
  removeSequence: (id: string) => void;
};

type EditingState = {
  sequenceId: string;
  draftName: string;
};

export function CameraSequenceList({
  sequences,
  selectedSequenceId,
  setCurrentSequence,
  addSequence,
  renameSequence,
  removeSequence,
}: CameraSequenceListProps) {
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const { confirm } = useConfirmation();

  const handleToggleSelect = (sequenceId: string) => {
    if (selectedSequenceId === sequenceId) {
      setCurrentSequence(null);
    } else {
      setCurrentSequence(sequenceId);
    }
  };

  const handleAddSequence = () => {
    const newId = addSequence(`Sequence ${sequences.length + 1}`);
    setCurrentSequence(newId);
  };

  const handleStartRename = (sequence: CameraSequence) => {
    setEditingState({ sequenceId: sequence.id, draftName: sequence.name });
  };

  const handleSaveRename = () => {
    if (!editingState) return;

    const newName = editingState.draftName.trim();
    const currentName = sequences.find((s) => s.id === editingState.sequenceId)?.name ?? "";

    if (newName !== currentName && newName.length > 0) {
      renameSequence(editingState.sequenceId, newName);
    }

    setEditingState(null);
  };

  const handleCancelRename = () => {
    setEditingState(null);
  };

  const handleDeleteSequence = async (sequenceId: string) => {
    const sequenceName = sequences.find((s) => s.id === sequenceId)?.name ?? "Unknown";
    const confirmed = await confirm({
      title: "Delete Camera Sequence",
      message: `Are you sure you want to delete the camera sequence "${sequenceName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      isDangerous: true,
    });

    if (confirmed) {
      removeSequence(sequenceId);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Camera Sequences</h3>
      {sequences.length > 0 ? (
        <div className="border border-gray-300 rounded bg-white max-h-48 overflow-y-auto">
          <ul className="divide-y divide-gray-200">
            {sequences.map((sequence) => {
              const isEditing = editingState?.sequenceId === sequence.id;

              return (
                <li
                  key={sequence.id}
                  className={`px-3 py-2 flex items-center gap-2 group ${
                    selectedSequenceId === sequence.id && !isEditing ? "bg-blue-500 hover:bg-blue-600" : "hover:bg-gray-50"
                  } ${isEditing ? "" : "cursor-pointer"}`}
                  onClick={() => {
                    if (!isEditing) {
                      handleToggleSelect(sequence.id);
                    }
                  }}
                >
                  {isEditing ? (
                  <input
                    autoFocus
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    value={editingState.draftName}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setEditingState({ ...editingState, draftName: e.target.value })
                    }
                    onBlur={handleSaveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename();
                      if (e.key === "Escape") handleCancelRename();
                    }}
                  />
                  ) : (
                    <>
                      <div
                        className={`flex-1 select-none text-left text-xs font-medium truncate ${
                          selectedSequenceId === sequence.id ? "text-white" : "text-gray-700 hover:text-gray-900"
                        }`}
                        title={sequence.name}
                      >
                      {sequence.name}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(sequence);
                        }}
                        className={`opacity-0 group-hover:opacity-100 transition p-1 cursor-pointer ${
                          selectedSequenceId === sequence.id
                            ? "text-blue-100 hover:text-white"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        aria-label="Rename sequence"
                        title="Rename"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSequence(sequence.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 transition p-1 cursor-pointer ${
                          selectedSequenceId === sequence.id
                            ? "text-blue-100 hover:text-red-200"
                            : "text-gray-400 hover:text-red-600"
                        }`}
                        aria-label="Delete sequence"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-xs text-gray-400">
          No sequences
        </div>
      )}

      <button
        type="button"
        onClick={handleAddSequence}
        className="w-full select-none rounded border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
      >
        + Add Sequence
      </button>

      {selectedSequenceId && (
        <div className="text-[11px] text-gray-500">
          <div className="font-semibold mb-1">How to use the camera timeline editor:</div>
          <ul className="ml-2 list-disc list-inside space-y-0.5">
            <li>Click marker: go to camera keyframe</li>
            <li>Click active marker: update from current camera</li>
            <li>Right-click marker: delete keyframe</li>
            <li>Click in empty space: add keyframe</li>
          </ul>
        </div>
      )}
    </div>
  );
}
