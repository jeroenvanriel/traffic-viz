import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [scenes, setscenes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/scenes")
      .then((res) => res.json())
      .then((data) => {
        setscenes(data.scenes);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex justify-center mt-10 px-4">
        <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 border border-gray-200">
          <div className="mb-5 max-w-sm mx-auto w-full">
            <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <Link
                to="/"
                className="rounded-md bg-white px-3 py-2 text-center text-sm font-semibold text-gray-900 shadow-sm"
              >
                Scene Overview
              </Link>
              <Link
                to="/models"
                className="rounded-md px-3 py-2 text-center text-sm font-semibold text-gray-500 transition hover:text-gray-700"
              >
                Model Library
              </Link>
            </div>
          </div>

          {loading && <div>Loading scenes...</div>}

          {error && <div>Error: {error}</div>}

          {!loading && !error && (
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenes.map((name) => (
                <li key={name}>
                  <Link
                    to={`/scene/${name}`}
                    className="block rounded-lg p-3 border bg-gray-50 border-gray-200 transition hover:bg-gray-100"
                  >
                    <div className="w-full aspect-square mb-2 rounded overflow-hidden bg-gray-100 border border-gray-200">
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        No thumbnail
                      </div>
                    </div>

                    <div className="text-sm font-semibold truncate text-gray-900">{name}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
