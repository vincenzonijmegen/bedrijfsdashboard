"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type BeschikbaarheidData = {
  medewerker_naam: string | null;
  medewerker_email: string;
  ronde_naam: string;
  start_datum: string;
  eind_datum: string;
  deadline: string | null;
  ronde_toelichting: string | null;
  status: string;
  herinner_mij_op: string | null;
  ma_shift_1: boolean | null;
  ma_shift_2: boolean | null;
  di_shift_1: boolean | null;
  di_shift_2: boolean | null;
  wo_shift_1: boolean | null;
  wo_shift_2: boolean | null;
  do_shift_1: boolean | null;
  do_shift_2: boolean | null;
  vr_shift_1: boolean | null;
  vr_shift_2: boolean | null;
  za_shift_1: boolean | null;
  za_shift_2: boolean | null;
  zo_shift_1: boolean | null;
  zo_shift_2: boolean | null;
  max_diensten_per_week: number | null;
  opgave_toelichting: string | null;
};

type ShiftField =
  | "ma_shift_1" | "ma_shift_2"
  | "di_shift_1" | "di_shift_2"
  | "wo_shift_1" | "wo_shift_2"
  | "do_shift_1" | "do_shift_2"
  | "vr_shift_1" | "vr_shift_2"
  | "za_shift_1" | "za_shift_2"
  | "zo_shift_1" | "zo_shift_2";

type FormState = {
  ma_shift_1: boolean;
  ma_shift_2: boolean;
  di_shift_1: boolean;
  di_shift_2: boolean;
  wo_shift_1: boolean;
  wo_shift_2: boolean;
  do_shift_1: boolean;
  do_shift_2: boolean;
  vr_shift_1: boolean;
  vr_shift_2: boolean;
  za_shift_1: boolean;
  za_shift_2: boolean;
  zo_shift_1: boolean;
  zo_shift_2: boolean;
  max_diensten_per_week: string;
  toelichting: string;
};

const dagen = [
  ["ma", "Maandag"],
  ["di", "Dinsdag"],
  ["wo", "Woensdag"],
  ["do", "Donderdag"],
  ["vr", "Vrijdag"],
  ["za", "Zaterdag"],
  ["zo", "Zondag"],
] as const;

const legeForm: FormState = {
  ma_shift_1: false,
  ma_shift_2: false,
  di_shift_1: false,
  di_shift_2: false,
  wo_shift_1: false,
  wo_shift_2: false,
  do_shift_1: false,
  do_shift_2: false,
  vr_shift_1: false,
  vr_shift_2: false,
  za_shift_1: false,
  za_shift_2: false,
  zo_shift_1: false,
  zo_shift_2: false,
  max_diensten_per_week: "",
  toelichting: "",
};

const datum = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nl-NL");
};

const uitersteHerinnerDatum = (startDatum: string) => {
  const datum = new Date(startDatum);
  datum.setDate(datum.getDate() - 14);
  return datum.toISOString().slice(0, 10);
};

export default function BeschikbaarheidInvullenPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<BeschikbaarheidData | null>(null);
  const [form, setForm] = useState<FormState>(legeForm);
  const [modus, setModus] = useState<"invullen" | "uitstellen">("invullen");
  const [herinnerMijOp, setHerinnerMijOp] = useState("");
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    const laad = async () => {
      setLaden(true);
      const res = await fetch(`/api/beschikbaarheid/token/${token}`);
      const json = await res.json();
      setLaden(false);

      if (!res.ok) {
        setFout(json.error || "Deze link werkt niet.");
        return;
      }

      setData(json);
      setForm({
        ma_shift_1: Boolean(json.ma_shift_1),
        ma_shift_2: Boolean(json.ma_shift_2),
        di_shift_1: Boolean(json.di_shift_1),
        di_shift_2: Boolean(json.di_shift_2),
        wo_shift_1: Boolean(json.wo_shift_1),
        wo_shift_2: Boolean(json.wo_shift_2),
        do_shift_1: Boolean(json.do_shift_1),
        do_shift_2: Boolean(json.do_shift_2),
        vr_shift_1: Boolean(json.vr_shift_1),
        vr_shift_2: Boolean(json.vr_shift_2),
        za_shift_1: Boolean(json.za_shift_1),
        za_shift_2: Boolean(json.za_shift_2),
        zo_shift_1: Boolean(json.zo_shift_1),
        zo_shift_2: Boolean(json.zo_shift_2),
        max_diensten_per_week: json.max_diensten_per_week ? String(json.max_diensten_per_week) : "",
        toelichting: json.opgave_toelichting || "",
      });
      setHerinnerMijOp(json.herinner_mij_op || "");
    };

    if (token) laad();
  }, [token]);

  const toggle = (field: ShiftField) => {
    setForm((huidig) => ({ ...huidig, [field]: !huidig[field] }));
  };

  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(null);
    setOpslaan(true);

    const body = modus === "uitstellen"
      ? { actie: "uitstellen", herinner_mij_op: herinnerMijOp }
      : { actie: "invullen", ...form };

    const res = await fetch(`/api/beschikbaarheid/token/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setOpslaan(false);

    if (!res.ok) {
      setFout(json.error || "Opslaan mislukt");
      return;
    }

    setSucces(
      modus === "uitstellen"
        ? "Dank je. We herinneren je opnieuw op de gekozen datum."
        : "Dank je. Je beschikbaarheid is opgeslagen."
    );
  };

  if (laden) return <main className="mx-auto max-w-2xl p-6">Bezig met laden...</main>;

  if (fout && !data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{fout}</div>
      </main>
    );
  }

  if (!data) return null;

  const uitersteDatum = uitersteHerinnerDatum(data.start_datum);

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Beschikbaarheid invullen</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.ronde_naam} · {datum(data.start_datum)} t/m {datum(data.eind_datum)}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Hoi {data.medewerker_naam || data.medewerker_email}, vul hieronder je beschikbaarheid in.
        </p>
        {data.ronde_toelichting && (
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{data.ronde_toelichting}</p>
        )}
        {data.status === "ingevuld" && (
          <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            Je had deze beschikbaarheid al ingevuld. Je kunt hem hieronder nog aanpassen en opnieuw opslaan.
          </p>
        )}
      </section>

      {fout && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">❌ {fout}</div>}
      {succes && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">✅ {succes}</div>}

      <form onSubmit={verstuur} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Weet je je beschikbaarheid al?</h2>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="modus"
                checked={modus === "invullen"}
                onChange={() => setModus("invullen")}
              />
              <span>Ja, ik vul mijn beschikbaarheid nu in</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
              <input
                type="radio"
                name="modus"
                checked={modus === "uitstellen"}
                onChange={() => setModus("uitstellen")}
              />
              <span>Nee, ik weet het nog niet. Herinner mij opnieuw op een datum</span>
            </label>
          </div>

          {modus === "uitstellen" && (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700">Herinner mij opnieuw op</label>
              <input
                type="date"
                className="w-full rounded border p-3"
                value={herinnerMijOp}
                max={uitersteDatum}
                onChange={(e) => setHerinnerMijOp(e.target.value)}
                required={modus === "uitstellen"}
              />
              <p className="text-xs text-slate-500">
                Kies uiterlijk {datum(uitersteDatum)}. We hebben je beschikbaarheid minimaal twee weken voor de start nodig.
              </p>
            </div>
          )}
        </section>

        {modus === "invullen" && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Beschikbaarheid per weekdag</h2>
              <div className="space-y-2">
                {dagen.map(([key, label]) => (
                  <div key={key} className="grid grid-cols-3 items-center gap-2 rounded-xl border p-3">
                    <div className="font-medium text-slate-800">{label}</div>
                    <label className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-2">
                      <input
                        type="checkbox"
                        checked={Boolean(form[`${key}_shift_1` as ShiftField])}
                        onChange={() => toggle(`${key}_shift_1` as ShiftField)}
                      />
                      <span>Shift 1</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-2">
                      <input
                        type="checkbox"
                        checked={Boolean(form[`${key}_shift_2` as ShiftField])}
                        onChange={() => toggle(`${key}_shift_2` as ShiftField)}
                      />
                      <span>Shift 2</span>
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block text-sm font-medium text-slate-700">
                Hoe vaak wil je maximaal per week werken?
              </label>
              <select
                className="mt-2 w-full rounded border p-3"
                value={form.max_diensten_per_week}
                onChange={(e) => setForm({ ...form, max_diensten_per_week: e.target.value })}
              >
                <option value="">Maak een keuze</option>
                {[1, 2, 3, 4, 5, 6, 7].map((aantal) => (
                  <option key={aantal} value={aantal}>{aantal} keer per week</option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-medium text-slate-700">Eventuele toelichting</label>
              <textarea
                className="mt-2 w-full rounded border p-3"
                rows={4}
                placeholder="Bijvoorbeeld: maandag alleen om de week, of vanaf oktober verandert mijn rooster weer."
                value={form.toelichting}
                onChange={(e) => setForm({ ...form, toelichting: e.target.value })}
              />
            </section>
          </>
        )}

        <button
          disabled={opslaan}
          className="w-full rounded-xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {opslaan ? "Bezig met opslaan..." : modus === "uitstellen" ? "Herinnerdatum opslaan" : "Beschikbaarheid versturen"}
        </button>
      </form>
    </main>
  );
}
