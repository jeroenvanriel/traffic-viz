import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { renderModelThumbnail } from "../utils/modelThumbnail";

const API_BASE_URL = "http://localhost:8000";

type ModelInfo = {
  model_id: string;
  original_filename: string;
  stored_filename: string;
  type: string;
  added_at: string;
  thumbnail_url?: string | null;
};

async function uploadModel(file: File): Promise<ModelInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload-model`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return await response.json();
}

async function uploadModelThumbnail(modelId: string, thumbnailBlob: Blob): Promise<ModelInfo> {
  const formData = new FormData();
  formData.append("file", new File([thumbnailBlob], `${modelId}.png`, { type: "image/png" }));

  const response = await fetch(`${API_BASE_URL}/api/models/${modelId}/thumbnail`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Thumbnail upload failed");
  }

  return await response.json();
}

type ModelUploaderProps = {
  onUpload: (result: ModelInfo) => void;
};
function ModelUploader({ onUpload }: ModelUploaderProps) {
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadModel(file);
      onUpload(result); // pass model info up immediately

      try {
        const modelUrl = `${API_BASE_URL}/model-files/${result.stored_filename}`;
        const thumbnailBlob = await renderModelThumbnail(modelUrl, 512);
        const updatedModel = await uploadModelThumbnail(result.model_id, thumbnailBlob);
        onUpload(updatedModel);
      } catch (thumbnailErr) {
        console.error("Thumbnail generation/upload failed", thumbnailErr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <label className="w-full cursor-pointer bg-gray-50 hover:bg-gray-100 transition rounded px-4 py-2 text-gray-700 border border-gray-200 flex items-center justify-center mb-4">
      <span className="text-black text-2xl">+</span>
      <input type="file" accept=".glb,.gltf" onChange={handleChange} className="hidden" />
    </label>
  );
}

async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE_URL}/api/models`);

  if (!res.ok) {
    throw new Error("Failed to fetch models");
  }

  return res.json();
}

async function deleteModel(modelId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/models/${modelId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete model");
  }
}

async function updateModelType(modelId: string, type: string): Promise<ModelInfo> {
  const res = await fetch(`${API_BASE_URL}/api/models/${modelId}/type`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });

  if (!res.ok) {
    throw new Error("Failed to update model type");
  }

  return res.json();
}

type ModelCardProps = {
  model: ModelInfo;
  onDeleted: (modelId: string) => void;
  onTypePatched: (model: ModelInfo) => void;
};

function ModelCard({ model, onDeleted, onTypePatched }: ModelCardProps) {
  const [isEditingType, setIsEditingType] = useState(false);
  const [draftType, setDraftType] = useState(model.type ?? "");
  const [isSavingType, setIsSavingType] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isEditingType) {
      setDraftType(model.type ?? "");
    }
  }, [model.type, isEditingType]);

  const saveType = async () => {
    const nextType = draftType.trim();
    const currentType = (model.type ?? "").trim();
    if (nextType === currentType) {
      setIsEditingType(false);
      return;
    }

    try {
      setIsSavingType(true);
      const patched = await updateModelType(model.model_id, nextType);
      onTypePatched(patched);
      setIsEditingType(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingType(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteModel(model.model_id);
      onDeleted(model.model_id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <li className="rounded-lg p-3 border bg-gray-50 border-gray-200">
      <div className="w-full aspect-square mb-2 rounded overflow-hidden bg-gray-100 border border-gray-200">
        {model.thumbnail_url ? (
          <img
            src={model.thumbnail_url}
            alt={model.original_filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
            No thumbnail
          </div>
        )}
      </div>

      <div className="mb-1 group flex items-center gap-1 min-h-6">
        {isEditingType ? (
          <input
            autoFocus
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
            onBlur={saveType}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveType();
              if (e.key === "Escape") {
                setDraftType(model.type ?? "");
                setIsEditingType(false);
              }
            }}
            disabled={isSavingType}
          />
        ) : (
          <>
            <div className={`text-sm font-semibold truncate ${model.type ? "text-gray-900" : "text-gray-400"}`}>
              {model.type || "<no name>"}
            </div>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-gray-700"
              onClick={() => setIsEditingType(true)}
              aria-label="Edit model type"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="text-xs text-gray-400 truncate">{model.original_filename}</div>
      <div className="text-[11px] text-gray-400 truncate mb-3">{model.model_id}</div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete model
        </button>
        <Link
          to={`/models/${model.model_id}/configure`}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          Configure
        </Link>
      </div>
    </li>
  );
}

type ModelListProps = {
  refreshKey?: number;
};
export function ModelList({ refreshKey = 0 }: ModelListProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchModels()
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleDeleted = (modelId: string) => {
    setModels((prev) => prev.filter((m) => m.model_id !== modelId));
  };

  const handleTypePatched = (patched: ModelInfo) => {
    setModels((prev) => prev.map((m) => (m.model_id === patched.model_id ? patched : m)));
  };

  if (loading) return <div>Loading models...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="mb-3">
      {models.length === 0 && <div>No models uploaded yet.</div>}

      <ul className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {models.map((model) => (
          <ModelCard
            key={model.model_id}
            model={model}
            onDeleted={handleDeleted}
            onTypePatched={handleTypePatched}
          />
        ))}
      </ul>
    </div>
  );
}

export default function ModelLibraryPage() {
  const [modelsRefreshKey, setModelsRefreshKey] = useState(0);

  return (
    <div>
      <div className="flex justify-center mt-10 px-4">
        <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 border border-gray-200">
          <div className="mb-5 max-w-sm mx-auto w-full">
            <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <Link
                to="/"
                className="rounded-md px-3 py-2 text-center text-sm font-semibold text-gray-500 transition hover:text-gray-700"
              >
                Scene Overview
              </Link>
              <Link
                to="/models"
                className="rounded-md bg-white px-3 py-2 text-center text-sm font-semibold text-gray-900 shadow-sm"
              >
                Model Library
              </Link>
            </div>
          </div>

          <ModelList refreshKey={modelsRefreshKey} />

          <ModelUploader
            onUpload={() => {
              setModelsRefreshKey((key) => key + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
