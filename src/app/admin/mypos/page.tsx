"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

export default function MyPOSImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/mypos/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`✅ ${data.imported} transacties geïmporteerd.`);
      } else {
        setMessage(`❌ ${data.error || "Onbekende fout"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <FileSpreadsheet className="h-4 w-4" />
            Rapportage / MyPOS
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            MyPOS XLS importeren
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Upload een XLSX-bestand om transacties te importeren.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Bestand
            </span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploaden...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload XLSX
              </>
            )}
          </button>

          {message && (
            <div
              className={`mt-5 rounded-xl px-4 py-3 text-sm ring-1 ${
                message.startsWith("✅")
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                  : "bg-red-50 text-red-700 ring-red-100"
              }`}
            >
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}