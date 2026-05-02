// src/app/admin/dossier/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

function berekenLeeftijd(value: string | null) {
  if (!value) return null;

  const geboortedatum = new Date(value);
  const vandaag = new Date();

  let leeftijd = vandaag.getFullYear() - geboortedatum.getFullYear();
  const maandVerschil = vandaag.getMonth() - geboortedatum.getMonth();

  if (
    maandVerschil < 0 ||
    (maandVerschil === 0 && vandaag.getDate() < geboortedatum.getDate())
  ) {
    leeftijd--;
  }

  return leeftijd;
}

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: nl });
  } catch {
    return dateStr;
  }
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Medewerker {
  email: string;
  naam: string;
  kan_scheppen?: boolean;
  kan_voorbereiden?: boolean;
  kan_ijsbereiden?: boolean;
}

interface Ziekteverzuim {
  id: number;
  van: string;
  tot: string;
  opmerking: string;
}

export default function DossierOverzicht() {
  const [editVan, setEditVan] = useState("");
  const [editTot, setEditTot] = useState("");
  const [email, setEmail] = useState("");
  const [tekst, setTekst] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const [actieveUrl, setActieveUrl] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTekst, setEditTekst] = useState("");

  const [kanScheppen, setKanScheppen] = useState(true);
  const [kanVoorbereiden, setKanVoorbereiden] = useState(false);
  const [kanIjsbereiden, setKanIjsbereiden] = useState(false);
  const [skillsOpslaan, setSkillsOpslaan] = useState(false);
  const [skillsSuccess, setSkillsSuccess] = useState(false);

  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");
  const [opmerkingZiekte, setOpmerkingZiekte] = useState("");

  const { data: opmerkingen, mutate } = useSWR(
    email ? `/api/dossier/opmerkingen?email=${email}` : null,
    fetcher
  );

  const { data: medewerkersData, mutate: mutateMedewerkers } = useSWR(
    "/api/admin/medewerkers",
    fetcher
  );

  const medewerkers: Medewerker[] = Array.isArray(medewerkersData)
    ? medewerkersData
    : medewerkersData?.items ?? [];

  const { data: documenten, mutate: mutateDocumenten } = useSWR(
    email ? `/api/dossier/document?email=${email}` : null,
    fetcher
  );

  const { data: sollicitatieData } = useSWR(
    email ? `/api/dossier/sollicitatie?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const sollicitatie = sollicitatieData?.sollicitatie;
  const geselecteerde = medewerkers?.find((m) => m.email === email);

  useEffect(() => {
    if (!geselecteerde) return;

    setKanScheppen(geselecteerde.kan_scheppen ?? true);
    setKanVoorbereiden(geselecteerde.kan_voorbereiden ?? false);
    setKanIjsbereiden(geselecteerde.kan_ijsbereiden ?? false);
    setSkillsSuccess(false);
  }, [geselecteerde]);

  const { data: verzuim, mutate: mutateVerzuim } = useSWR<Ziekteverzuim[]>(
    geselecteerde ? `/api/medewerkers/${geselecteerde.email}/verzuim` : null,
    fetcher
  );

  const slaSkillsOp = async () => {
    if (!geselecteerde) return;

    setSkillsOpslaan(true);
    setSkillsSuccess(false);

    const res = await fetch(
      `/api/admin/medewerkers/${encodeURIComponent(
        geselecteerde.email
      )}/skills`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kan_scheppen: kanScheppen,
          kan_voorbereiden: kanVoorbereiden,
          kan_ijsbereiden: kanIjsbereiden,
        }),
      }
    );

    setSkillsOpslaan(false);

    if (res.ok) {
      setSkillsSuccess(true);
      mutateMedewerkers();
      setTimeout(() => setSkillsSuccess(false), 3000);
    } else {
      alert("Opslaan van planning-skills mislukt.");
    }
  };

  const voegToe = async () => {
    if (!email || !tekst.trim()) return;

    await fetch("/api/dossier/opmerkingen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tekst }),
    });

    setTekst("");
    setSuccess(true);
    mutate();
    setTimeout(() => setSuccess(false), 3000);
  };

  const uploadBestand = async () => {
    if (!file || !email) {
      alert("Selecteer een medewerker en een bestand");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    const res = await fetch("/api/dossier/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setFile(null);
      (document.getElementById("upload") as HTMLInputElement).value = "";
      setSuccess(true);
      mutateDocumenten();
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const voegZiekteverzuimToe = async () => {
    if (!van || !geselecteerde) return;

    await fetch(`/api/medewerkers/${geselecteerde.email}/verzuim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        van,
        tot: tot?.length > 0 ? tot : null,
        opmerking: opmerkingZiekte,
      }),
    });

    setVan("");
    setTot("");
    setOpmerkingZiekte("");
    mutateVerzuim();
  };

  const verwijderZiekteverzuim = async (id: number) => {
    await fetch(`/api/medewerkers/verzuim/${id}`, { method: "DELETE" });
    mutateVerzuim();
  };

  const verwijderOpmerking = async (id: number) => {
    await fetch("/api/dossier/opmerkingen", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    mutate();
  };

  const bewerkOpmerking = async (id: number) => {
    await fetch("/api/dossier/opmerkingen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tekst: editTekst }),
    });

    setEditId(null);
    setEditTekst("");
    mutate();
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Admin</p>
              <h1 className="text-2xl font-bold tracking-tight">
                Personeelsdossier
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Documenten, opmerkingen, verzuim en planning-skills per medewerker.
              </p>
            </div>

            <label className="w-full md:w-80">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Kies medewerker
              </span>
              <select
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">-- Kies medewerker --</option>
                {medewerkers?.map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.naam}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {!email && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Selecteer een medewerker om het dossier te bekijken.
            </p>
          </div>
        )}

        {email && (
          <>
            {geselecteerde && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Planning / inzetbaarheid
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Deze vaardigheden worden gebruikt voor de zomerfeestenplanning.
                    </p>
                  </div>

                  {skillsSuccess && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      Opgeslagen
                    </span>
                  )}
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={kanScheppen}
                      onChange={(e) => setKanScheppen(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span>Kan scheppen</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={kanVoorbereiden}
                      onChange={(e) => setKanVoorbereiden(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span>Kan voorbereiden</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={kanIjsbereiden}
                      onChange={(e) => setKanIjsbereiden(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span>Kan ijs bereiden</span>
                  </label>
                </div>

                <button
                  onClick={slaSkillsOp}
                  disabled={skillsOpslaan}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {skillsOpslaan ? "Opslaan..." : "Planning-skills opslaan"}
                </button>
              </div>
            )}

            {sollicitatie && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-blue-950">
                  Sollicitatiegegevens
                </h2>

                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <strong>Naam:</strong> {sollicitatie.voornaam}{" "}
                    {sollicitatie.achternaam}
                  </div>
                  <div>
                    <strong>Telefoon:</strong> {sollicitatie.telefoon || "-"}
                  </div>
                  <div>
                    <strong>Email:</strong> {sollicitatie.email || "-"}
                  </div>
                  <div>
                    <strong>Geboortedatum:</strong>{" "}
                    {sollicitatie.geboortedatum
                      ? `${formatDate(sollicitatie.geboortedatum)} (${berekenLeeftijd(
                          sollicitatie.geboortedatum
                        )} jaar)`
                      : "-"}
                  </div>
                  <div>
                    <strong>Adres:</strong> {sollicitatie.adres || "-"}{" "}
                    {sollicitatie.huisnummer || ""}
                  </div>
                  <div>
                    <strong>PC/Woonplaats:</strong>{" "}
                    {sollicitatie.postcode || "-"} {sollicitatie.woonplaats || ""}
                  </div>
                  <div>
                    <strong>Beschikbaar vanaf:</strong>{" "}
                    {sollicitatie.beschikbaar_vanaf
                      ? formatDate(sollicitatie.beschikbaar_vanaf)
                      : "-"}
                  </div>
                  <div>
                    <strong>Beschikbaar tot:</strong>{" "}
                    {sollicitatie.beschikbaar_tot
                      ? formatDate(sollicitatie.beschikbaar_tot)
                      : "-"}
                  </div>
                  <div>
                    <strong>Shifts per week:</strong>{" "}
                    {sollicitatie.shifts_per_week || "-"}
                  </div>
                  <div>
                    <strong>Voorkeur functie:</strong>{" "}
                    {sollicitatie.voorkeur_functie || "-"}
                  </div>
                  <div>
                    <strong>Andere bijbaan:</strong> {sollicitatie.bijbaan || "-"}
                  </div>
                  <div>
                    <strong>Vakantie:</strong> {sollicitatie.vakantie || "-"}
                  </div>
                  <div>
                    <strong>Gesprek:</strong>{" "}
                    {sollicitatie.gesprek_datum
                      ? formatDate(sollicitatie.gesprek_datum)
                      : "-"}
                  </div>
                  <div>
                    <strong>Status sollicitatie:</strong>{" "}
                    {sollicitatie.status || "-"}
                  </div>
                </div>

                {Array.isArray(sollicitatie.beschikbaar_momenten) &&
                  sollicitatie.beschikbaar_momenten.length > 0 && (
                    <div className="mt-5">
                      <strong className="text-sm">Opgegeven beschikbaarheid:</strong>
                      <ul className="mt-2 grid list-disc gap-x-6 pl-5 text-sm md:grid-cols-2">
                        {sollicitatie.beschikbaar_momenten.map(
                          (moment: string) => (
                            <li key={moment}>{moment}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  {sollicitatie.ervaring && (
                    <div>
                      <strong>Werkervaring:</strong> {sollicitatie.ervaring}
                    </div>
                  )}
                  {sollicitatie.opleiding && (
                    <div>
                      <strong>Opleiding:</strong> {sollicitatie.opleiding}
                    </div>
                  )}
                  {sollicitatie.rekenen && (
                    <div>
                      <strong>Rekenvaardigheid:</strong> {sollicitatie.rekenen}
                    </div>
                  )}
                  {sollicitatie.kassa && (
                    <div>
                      <strong>Kassa-ervaring:</strong> {sollicitatie.kassa}
                    </div>
                  )}
                  {sollicitatie.duits && (
                    <div>
                      <strong>Duits:</strong> {sollicitatie.duits}
                    </div>
                  )}
                  {sollicitatie.extra && (
                    <div>
                      <strong>Extra:</strong> {sollicitatie.extra}
                    </div>
                  )}
                </div>

                {sollicitatie.gesprek_notities && (
                  <div className="mt-5">
                    <strong className="text-sm">Gespreksnotities:</strong>
                    <p className="mt-1 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm shadow-sm">
                      {sollicitatie.gesprek_notities}
                    </p>
                  </div>
                )}

                {sollicitatie.motivatie && (
                  <div className="mt-5">
                    <strong className="text-sm">Motivatie / opmerking:</strong>
                    <p className="mt-1 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm shadow-sm">
                      {sollicitatie.motivatie}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Opmerking toevoegen</h2>
                <textarea
                  value={tekst}
                  onChange={(e) => setTekst(e.target.value)}
                  placeholder="Typ hier een interne opmerking..."
                  className="mt-3 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={voegToe}
                  className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Opmerking opslaan
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Document uploaden</h2>
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <input
                    id="upload"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  <button
                    onClick={uploadBestand}
                    className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Upload bestand
                  </button>
                </div>

                {documenten?.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-sm font-bold text-slate-700">
                      Documenten
                    </h3>
                    <div className="space-y-2">
                      {documenten.map((doc: { bestand_url: string }, i: number) => (
                        <button
                          key={i}
                          onClick={() => setActieveUrl(doc.bestand_url)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <span>📄 Bekijk document {i + 1}</span>
                          <span className="text-xs text-slate-400">Openen</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                Opgeslagen
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">Ziekteverzuim</h2>

              <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_auto]">
                <input
                  type="date"
                  value={van}
                  onChange={(e) => setVan(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="date"
                  value={tot}
                  onChange={(e) => setTot(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="text"
                  value={opmerkingZiekte}
                  onChange={(e) => setOpmerkingZiekte(e.target.value)}
                  placeholder="Toelichting"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={voegZiekteverzuimToe}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Toevoegen
                </button>
              </div>

              {Array.isArray(verzuim) && verzuim.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {verzuim.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm"
                    >
                      {editId === v.id ? (
                        <>
                          <div className="mb-3 grid gap-2 md:grid-cols-2">
                            <input
                              type="date"
                              value={editVan}
                              onChange={(e) => setEditVan(e.target.value)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="date"
                              value={editTot || ""}
                              onChange={(e) => setEditTot(e.target.value)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <textarea
                            value={editTekst}
                            onChange={(e) => setEditTekst(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                          />
                          <button
                            onClick={() => {
                              fetch(`/api/medewerkers/verzuim/${v.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  van: editVan,
                                  tot: editTot?.length > 0 ? editTot : null,
                                  opmerking: editTekst,
                                }),
                              }).then(() => {
                                setEditId(null);
                                setEditTekst("");
                                mutateVerzuim();
                              });
                            }}
                            className="mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                          >
                            Opslaan
                          </button>
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm leading-6">
                            <strong>{formatDate(v.van)}</strong>
                            {v.tot && v.van !== v.tot && (
                              <>
                                <span> t/m </span>
                                <strong>{formatDate(v.tot)}</strong>
                              </>
                            )}
                            {!v.tot && (
                              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                nog ziekgemeld
                              </span>
                            )}
                            <span> – {v.opmerking}</span>
                          </p>

                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => {
                                setEditId(v.id);
                                setEditTekst(v.opmerking);
                                setEditVan(v.van);
                                setEditTot(v.tot);
                              }}
                              className="rounded-lg bg-white px-2 py-1 text-sm shadow-sm hover:bg-slate-50"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => verwijderZiekteverzuim(v.id)}
                              className="rounded-lg bg-white px-2 py-1 text-sm shadow-sm hover:bg-red-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {opmerkingen?.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold">Opmerkingen</h2>

                <div className="space-y-3">
                  {opmerkingen.map(
                    (o: { id: number; tekst: string; datum: string }) => (
                      <div
                        key={o.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                      >
                        {editId === o.id ? (
                          <>
                            <textarea
                              value={editTekst}
                              onChange={(e) => setEditTekst(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                            />
                            <button
                              onClick={() => bewerkOpmerking(o.id)}
                              className="mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                            >
                              Opslaan
                            </button>
                          </>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm leading-6">
                              <strong>{formatDate(o.datum)}</strong> – {o.tekst}
                            </p>

                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() => {
                                  setEditId(o.id);
                                  setEditTekst(o.tekst);
                                }}
                                className="rounded-lg bg-white px-2 py-1 text-sm shadow-sm hover:bg-slate-100"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => verwijderOpmerking(o.id)}
                                className="rounded-lg bg-white px-2 py-1 text-sm shadow-sm hover:bg-red-50"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {actieveUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="relative h-[82vh] w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
              <button
                onClick={() => setActieveUrl(null)}
                className="absolute right-3 top-3 z-10 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              >
                ✕
              </button>

              {actieveUrl.endsWith(".pdf") ? (
                <iframe
                  src={`${actieveUrl}?v=${Date.now()}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                  className="h-full w-full rounded-xl border border-slate-200"
                />
              ) : (
                <img
                  src={actieveUrl}
                  alt="Document"
                  className="mx-auto max-h-full max-w-full rounded-xl"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}