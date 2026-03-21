import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ModelConfigurator from '../components/ModelConfigurator';

interface ModelInfo {
  model_id: string;
  original_filename: string;
  stored_filename: string;
  type: string;
  added_at: string;
  transform_config: {
    scale: [number, number, number];
    rotation: [number, number, number];
    offset: [number, number, number];
  };
  thumbnail_filename: string | null;
  thumbnail_url: string | null;
}

export default function ModelConfiguratorPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelId) {
      setError('Model ID is missing from URL');
      setLoading(false);
      return;
    }

    async function fetchModel() {
      try {
        const res = await fetch('http://localhost:8000/api/models');
        if (!res.ok) throw new Error('Failed to fetch models');

        const models: ModelInfo[] = await res.json();
        const found = models.find(m => m.model_id === modelId);

        if (!found) {
          setError('Model not found');
        } else {
          setModel(found);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchModel();
  }, [modelId]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading model...</div>;
  }

  if (error || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600">Error: {error || 'Model not found'}</p>
        <button
          onClick={() => navigate('/models')}
          className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1">
        <ModelConfigurator
          model={model}
          onSave={() => {}}
          onBackToLibrary={() => navigate('/models')}
        />
      </div>
    </div>
  );
}
