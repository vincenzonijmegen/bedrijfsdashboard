// File: src/app/admin/mypos/page.tsx

"use client";
import { useState } from "react";

export default function MyPOSImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/mypos/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
      setMessage(`Imported ${data.imported} transactions.`);
    } else {
      setMessage(data.error || 'Onbekende fout');
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">MyPOS XLS Importeren</h1>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={handleUpload}
        className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
        disabled={!file || loading}
      >
        {loading ? 'Uploading...' : 'Upload XLSX'}
      </button>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
