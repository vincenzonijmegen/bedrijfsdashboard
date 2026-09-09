"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, CheckCircle2, RefreshCw, Save } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const euro = (v: unknown) => v === null || v === undefined ? "—" : Number(v).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

type Resp = { success: boolean; data?: any; error?: string };

export default function CashflowBeheerPage() {
  const { data, error, mutate, isLoading } = useSWR<Resp>("/api/admin/cashflow", fetcher);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const d = data?.data;
  const bedragenPerStroom = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const b of d?.bedragen || []) {
      if (!map.has(b.stroom_id)) map.set(b.stroom_id, []);
      map.get(b.stroom_id)!.push(b);
    }
    return map;
  }, [d?.bedragen]);

  async function send(method: string, body: any) {
    setBusy(true); setMelding(null); setFout(null);
    try {
      const r = await fetch("/api/admin/cashflow", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "Opslaan mislukt");
      setMelding("Opgeslagen.");
      await mutate(j, false);
    } catch (e) { setFout(String(e)); } finally { setBusy(false); }
  }

  if (isLoading) return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-7xl">Cashflowbeheer laden…</div></main>;
  if (error || !data?.success || !d) return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-7xl rounded-xl bg-red-50 p-4 text-red-700">{data?.error || String(error)}</div></main>;

  return <main className="min-h-screen bg-slate-100 p-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Cashflowbeheer</h1>
        <p className="mt-1 text-sm text-slate-500">Beheer startsaldi, kasbuffers en tariefperiodes. Prognoseberekeningen volgen in een latere fase.</p>
      </header>

      {melding && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-800"><CheckCircle2 className="h-4 w-4" />{melding}</div>}
      {fout && <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-800"><AlertTriangle className="h-4 w-4" />{fout}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Entiteiten & minimum kasbuffer</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {d.entiteiten.map((e: any) => <EntiteitCard key={e.id} e={e} busy={busy} onSave={send} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Rekeningen & startsaldi</h2>
        <div className="mt-4 space-y-3">
          {d.rekeningen.map((r: any) => <RekeningRow key={r.id} r={r} busy={busy} onSave={send} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Vaste en planbare geldstromen</h2><button onClick={() => mutate()} className="flex items-center gap-2 text-sm text-slate-600"><RefreshCw className="h-4 w-4"/>Vernieuwen</button></div>
        <div className="mt-4 space-y-4">
          {d.stromen.map((s: any) => <StroomCard key={s.id} s={s} bedragen={bedragenPerStroom.get(s.id) || []} busy={busy} onSave={send} />)}
        </div>
      </section>
    </div>
  </main>;
}

function EntiteitCard({ e, busy, onSave }: any) {
  const [buffer, setBuffer] = useState(e.minimum_kasbuffer ?? "");
  const [groei, setGroei] = useState(e.prognosegroei_pct ?? "");
  return <div className="rounded-xl border p-4"><div className="font-semibold">{e.naam}</div><div className="mt-3 space-y-2"><label className="block text-xs text-slate-500">Minimum kasbuffer</label><input className="w-full rounded-lg border px-3 py-2" type="number" step="0.01" value={buffer} onChange={x=>setBuffer(x.target.value)}/><label className="block text-xs text-slate-500">Prognosegroei %</label><input className="w-full rounded-lg border px-3 py-2" type="number" step="0.1" value={groei} onChange={x=>setGroei(x.target.value)}/><button disabled={busy} onClick={()=>onSave("PATCH",{type:"instelling",entiteit_id:e.id,minimum_kasbuffer:buffer,prognosegroei_pct:groei})} className="mt-2 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"><Save className="h-4 w-4"/>Opslaan</button></div></div>;
}

function RekeningRow({ r, busy, onSave }: any) {
  const [saldo,setSaldo]=useState(r.prognose_startsaldo ?? ""); const [datum,setDatum]=useState(r.saldo_peildatum?.slice(0,10) ?? "");
  return <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"><div><div className="font-medium">{r.entiteit}</div><div className="text-sm text-slate-500">{r.naam} · {r.rekening_type}</div></div><div><label className="text-xs text-slate-500">Startsaldo</label><input className="mt-1 w-full rounded-lg border px-3 py-2" type="number" step="0.01" value={saldo} onChange={x=>setSaldo(x.target.value)}/></div><div><label className="text-xs text-slate-500">Peildatum</label><input className="mt-1 w-full rounded-lg border px-3 py-2" type="date" value={datum} onChange={x=>setDatum(x.target.value)}/></div><button disabled={busy} onClick={()=>onSave("PATCH",{type:"rekening",id:r.id,prognose_startsaldo:saldo,saldo_peildatum:datum})} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Opslaan</button></div>;
}

function StroomCard({ s, bedragen, busy, onSave }: any) {
  const [vanaf,setVanaf]=useState(""); const [tot,setTot]=useState(""); const [bedrag,setBedrag]=useState(""); const [pct,setPct]=useState(""); const [btw,setBtw]=useState("0"); const [aftrek,setAftrek]=useState("100");
  return <div className="rounded-xl border p-4"><div className="flex flex-col justify-between gap-2 md:flex-row"><div><div className="font-semibold">{s.naam}</div><div className="text-sm text-slate-500">{s.van_entiteit || "Extern"} → {s.naar_entiteit || s.tegenpartij_naam || "Extern"} · {s.frequentie} · {s.categorie}</div><div className="mt-1 text-xs text-slate-400">{s.startdatum?.slice(0,10)}{s.einddatum ? ` t/m ${s.einddatum.slice(0,10)}` : ""}{s.bron_stroom ? ` · bron: ${s.bron_stroom}` : ""}</div></div><div className="text-sm font-medium">{bedragen[0] ? (bedragen[0].bedrag != null ? euro(bedragen[0].bedrag) : `${Number(bedragen[0].percentage_van_bron).toLocaleString("nl-NL")}%`) : "Nog geen tarief"}</div></div>
    {bedragen.length>0 && <div className="mt-3 flex flex-wrap gap-2 text-xs">{bedragen.map((b:any)=><span key={b.id} className="rounded-full bg-slate-100 px-2 py-1">vanaf {b.geldig_vanaf.slice(0,10)}: {b.bedrag!=null?euro(b.bedrag):`${b.percentage_van_bron}%`}{b.geldig_tot?` t/m ${b.geldig_tot.slice(0,10)}`:""}</span>)}</div>}
    <div className="mt-4 grid gap-2 md:grid-cols-7"><input className="rounded-lg border px-2 py-2" type="date" value={vanaf} onChange={x=>setVanaf(x.target.value)}/><input className="rounded-lg border px-2 py-2" type="date" value={tot} onChange={x=>setTot(x.target.value)}/>{s.berekeningswijze==="percentage_van_bron"?<input className="rounded-lg border px-2 py-2" type="number" step="0.01" placeholder="% bron" value={pct} onChange={x=>setPct(x.target.value)}/>:<input className="rounded-lg border px-2 py-2" type="number" step="0.01" placeholder="Bedrag" value={bedrag} onChange={x=>setBedrag(x.target.value)}/>}<input className="rounded-lg border px-2 py-2" type="number" step="0.01" placeholder="BTW %" value={btw} onChange={x=>setBtw(x.target.value)}/><input className="rounded-lg border px-2 py-2" type="number" step="0.01" placeholder="Aftrek %" value={aftrek} onChange={x=>setAftrek(x.target.value)}/><button disabled={busy||!vanaf} onClick={()=>onSave("POST",{type:"bedrag",stroom_id:s.id,geldig_vanaf:vanaf,geldig_tot:tot,bedrag:s.berekeningswijze==="percentage_van_bron"?null:bedrag,percentage_van_bron:s.berekeningswijze==="percentage_van_bron"?pct:null,btw_percentage:btw,btw_aftrekbaar_percentage:aftrek,bedrag_is_inclusief_btw:true})} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Nieuw tarief</button></div>
  </div>;
}
