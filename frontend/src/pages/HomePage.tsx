import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [scenes, setscenes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/scenes")
      .then((res) => res.json())
      .then((data) => {
        setscenes(data.scenes);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading scenes…</div>;

  return (
    <div className="flex justify-center mt-10 px-4">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-xl p-6 border border-gray-200">
        <h1 className="font-bold text-xl mb-5 text-center">Scene Overview</h1>

        <ul className="space-y-3">
          {scenes.map((name) => (
            <Link
              key={name}
              to={`/scene/${name}`}
              className="block bg-gray-50 hover:bg-gray-100 transition rounded px-4 py-2 border border-gray-200 text-blue-700"
            >
              {name}
            </Link>
          ))}
        </ul>
      </div>
    </div>
  );
}
