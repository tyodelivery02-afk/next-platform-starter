import Link from "next/link";

export default function Home() {
  const features = [
    { name: "タスク担当者チェックシート", path: "/taskCheckSheet", color: "bg-green-500" },
    { name: "スパーフォーキャストメーカー", path: "/fcatmaker", color: "bg-blue-500" },
  ];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 bg-gradient-to-b from-gray-400 to-gray-900">
      <h1 className="text-2xl font-bold mb-8">メニュー</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-250">
        {features.map((f, idx) => (
          <Link
            key={idx}
            href={f.path}
            className={`rounded-2xl shadow p-8 text-center text-lg font-semibold hover:scale-105 transition transform ${f.color}`}
          >
            {f.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
