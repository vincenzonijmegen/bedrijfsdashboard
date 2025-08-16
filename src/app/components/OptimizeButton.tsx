'use client';

import { useState, useTransition } from 'react';

export default function OptimizeButton() {
  const [date, setDate] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const run = () => {
    if (!date) return setMsg('Kies eerst een datum.');
    start(async () => {
      setMsg('Rekenen…');
      try {
        const res = await fetch('/api/optimize/day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, doel_pct: 0.23 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Onbekende fout');
        setMsg(`OK: ${data.blocks_written} blokken • uren=${data.target_uren_dag} • €${data.geplande_kosten} • ${data.geplande_pct}%`);
      } catch (e: any) {
        setMsg(`Fout: ${e.message ?? e.toString()}`);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
               className="border rounded px-3 py-2" />
        <button onClick={run} disabled={pending}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-60">
          {pending ? 'Rekent…' : 'Herbereken planning (23%)'}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
