"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Clock,
  Printer,
  Users,
} from "lucide-react";

type Backup = {
  backup_run_id: string | number;
  snapshot_id: string | number | null;
  status: "gestart" | "voltooid" | "mislukt";
  periode_van: string;
  periode_tot: string;
  gestart_op: string;
  voltooid_op: string | null;
  aantal_diensten: number | null;
  payload_sha256: string | null;
  shiftbase_opgehaald_op: string | null;
  opgeslagen_op: string | null;
};

type ApiResponse = {
  success: boolean;
  backups?: Backup[];
  geselecteerdeBackup?: Backup | null;
  diensten?: unknown[];
  error?: string;
  details?: string;
};

type Dienst = {
  id: string;
  datum: string;
  starttijd: string;
  eindtijd: string;
  medewerker: string;
  shift: string;
  afdeling: string;
  omschrijving: string;
  pauze: string;
  openDienst: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function eersteWaarde(...waarden: unknown[]) {
  for (const waarde of waarden) {
    const tekst = asString(waarde).trim();
    if (tekst) return tekst;
  }
  return "";
}

function normaliseerDienst(item: unknown, index: number): Dienst | null {
  const itemObj = asRecord(item);
  const roster = asRecord(itemObj.Roster ?? item);
  const user = asRecord(itemObj.User);
  const shift = asRecord(itemObj.Shift);
  const department = asRecord(roster.Department ?? itemObj.Department);

  const datum = eersteWaarde(
    roster.date,
    roster.roster_date,
    itemObj.date,
    itemObj.roster_date
  ).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;

  const userId = eersteWaarde(roster.user_id, user.id, itemObj.user_id);
  const medewerker = eersteWaarde(
    user.name,
    user.fullName,
    user.full_name,
    roster.user_name,
    roster.employee_name,
    itemObj.user_name
  );

  const starttijd = eersteWaarde(
    roster.starttime,
    roster.start_time,
    itemObj.starttime,
    itemObj.start_time
  );
  const eindtijd = eersteWaarde(
    roster.endtime,
    roster.end_time,
    itemObj.endtime,
    itemObj.end_time
  );

  return {
    id:
      eersteWaarde(roster.occurrence_id, roster.id, itemObj.id) ||
      `${datum}-${starttijd}-${userId || index}`,
    datum,
    starttijd,
    eindtijd,
    medewerker: medewerker || (userId ? `Medewerker ${userId}` : "Open dienst"),
    shift: eersteWaarde(
      shift.long_name,
      shift.name,
      roster.name,
      roster.shift_name,
      itemObj.shift_name
    ),
    afdeling: eersteWaarde(
      department.name,
      roster.department_name,
      itemObj.department_name
    ),
    omschrijving: eersteWaarde(
      roster.description,
      itemObj.description,
      shift.description
    ),
    pauze: eersteWaarde(
      roster.break,
      roster.break_minutes,
      roster.pause,
      roster.pause_minutes,
      itemObj.break,
      itemObj.break_minutes
    ),
    openDienst: !userId && !medewerker,
  };
}

function formatDatumLang(value: string) {
  if (!value) return "—";
  const datum = new Date(`${value}T12:00:00`);
  if (Number.isNaN(datum.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(datum);
}

function formatDatumTijd(value: string | null) {
  if (!value) return "—";
  const datum = new Date(value);
  if (Number.isNaN(datum.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(datum);
}

function formatTijd(value: string) {
  if (!value) return "?";
  const match = value.match(/(\d{2}:\d{2})/);
  return match?.[1] || value;
}

function vandaagIso() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(
    nu.getDate()
  ).padStart(2, "0")}`;
}

export default function RoosterBackupPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [backupId, setBackupId] = useState("");
  const [datum, setDatum] = useState(vandaagIso());

  async function laadBackup(id?: string) {
    setLaden(true);
    setFout("");

    try {
      const query = id ? `?backup_run_id=${encodeURIComponent(id)}` : "";
      const response = await fetch(`/api/shiftbase/rooster-backups${query}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.success) {
        throw new Error(json.details || json.error || "Backup kon niet worden geladen.");
      }

      setData(json);
      const gekozenId = String(json.geselecteerdeBackup?.backup_run_id || "");
      setBackupId(gekozenId);
    } catch (error) {
      setFout(error instanceof Error ? error.message : String(error));
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    void laadBackup();
  }, []);

  const diensten = useMemo(
    () =>
      (data?.diensten ?? [])
        .map(normaliseerDienst)
        .filter((dienst): dienst is Dienst => dienst !== null),
    [data?.diensten]
  );

  const beschikbareDatums = useMemo(
    () => [...new Set(diensten.map((dienst) => dienst.datum))].sort(),
    [diensten]
  );

  useEffect(() => {
    if (!beschikbareDatums.length) return;
    if (beschikbareDatums.includes(datum)) return;

    const vandaag = vandaagIso();
    const eerstToekomstige = beschikbareDatums.find((waarde) => waarde >= vandaag);
    setDatum(eerstToekomstige || beschikbareDatums[0]);
  }, [beschikbareDatums, datum]);

  const dagDiensten = useMemo(
    () =>
      diensten
        .filter((dienst) => dienst.datum === datum)
        .sort((a, b) => {
          const tijd = a.starttijd.localeCompare(b.starttijd);
          return tijd !== 0 ? tijd : a.medewerker.localeCompare(b.medewerker, "nl");
        }),
    [diensten, datum]
  );

  const groepen = useMemo(() => {
    const resultaat = new Map<string, Dienst[]>();

    for (const dienst of dagDiensten) {
      const sleutel = dienst.shift || "Overige diensten";
      const bestaand = resultaat.get(sleutel) || [];
      bestaand.push(dienst);
      resultaat.set(sleutel, bestaand);
    }

    return [...resultaat.entries()];
  }, [dagDiensten]);

  const voltooideBackups = (data?.backups ?? []).filter(
    (backup) => backup.status === "voltooid" && backup.snapshot_id !== null
  );

  const geselecteerdeBackup = data?.geselecteerdeBackup ?? null;

  return (
    <main className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shiftbase roosterbackup</h1>
          <p className="mt-1 text-sm text-slate-600">
            Noodkopie om het rooster te bekijken en zo nodig handmatig in Shiftbase over te nemen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={!dagDiensten.length}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          Print dagrooster
        </button>
      </div>

      {fout && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Backup kon niet worden geopend</p>
            <p>{fout}</p>
          </div>
        </div>
      )}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 print:hidden">
        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">Backup</span>
          <select
            value={backupId}
            onChange={(event) => void laadBackup(event.target.value)}
            disabled={laden || !voltooideBackups.length}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {!voltooideBackups.length && <option value="">Geen backup beschikbaar</option>}
            {voltooideBackups.map((backup) => (
              <option key={String(backup.backup_run_id)} value={String(backup.backup_run_id)}>
                Backup {backup.backup_run_id} – {formatDatumTijd(backup.shiftbase_opgehaald_op)} – {backup.aantal_diensten ?? 0} diensten
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">Roosterdatum</span>
          <select
            value={datum}
            onChange={(event) => setDatum(event.target.value)}
            disabled={laden || !beschikbareDatums.length}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {beschikbareDatums.map((waarde) => (
              <option key={waarde} value={waarde}>
                {formatDatumLang(waarde)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {geselecteerdeBackup && (
        <section className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Archive className="h-4 w-4" /> Backup
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900">
              Nummer {geselecteerdeBackup.backup_run_id}
            </p>
            <p className="text-xs text-slate-500">
              {formatDatumTijd(geselecteerdeBackup.shiftbase_opgehaald_op)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <CalendarDays className="h-4 w-4" /> Periode
            </div>
            <p className="mt-2 font-bold text-slate-900">
              {geselecteerdeBackup.periode_van} t/m {geselecteerdeBackup.periode_tot}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Users className="h-4 w-4" /> Diensten
            </div>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {geselecteerdeBackup.aantal_diensten ?? diensten.length} totaal
            </p>
            <p className="text-xs text-slate-500">{dagDiensten.length} op gekozen dag</p>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Backup-rooster
            </p>
            <h2 className="text-xl font-bold capitalize text-slate-900">
              {formatDatumLang(datum)}
            </h2>
          </div>
        </div>

        {laden ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Backup wordt geladen…
          </div>
        ) : !geselecteerdeBackup ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            Er is nog geen voltooide roosterbackup beschikbaar.
          </div>
        ) : !dagDiensten.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            In deze backup staan voor deze datum geen diensten.
          </div>
        ) : (
          <div className="space-y-4">
            {groepen.map(([shiftNaam, shiftDiensten]) => (
              <div
                key={shiftNaam}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid"
              >
                <div className="flex items-center justify-between bg-slate-100 px-4 py-3">
                  <h3 className="font-bold text-slate-900">{shiftNaam}</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {shiftDiensten.length} {shiftDiensten.length === 1 ? "dienst" : "diensten"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {shiftDiensten.map((dienst) => (
                    <div
                      key={dienst.id}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[130px_1fr_1fr] sm:items-center"
                    >
                      <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {formatTijd(dienst.starttijd)}–{formatTijd(dienst.eindtijd)}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          {dienst.medewerker}
                          {dienst.openDienst && (
                            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              Open
                            </span>
                          )}
                        </p>
                        {dienst.afdeling && (
                          <p className="text-xs text-slate-500">{dienst.afdeling}</p>
                        )}
                      </div>

                      <div className="text-sm text-slate-600">
                        {dienst.omschrijving && <p>{dienst.omschrijving}</p>}
                        {dienst.pauze && <p className="text-xs">Pauze: {dienst.pauze}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
