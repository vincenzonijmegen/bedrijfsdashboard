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

  const { data: documenten } = useSWR(
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
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Personeelsdossier</h1>

      <label className="mb-2 block">
        Kies medewerker:
        <select
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ml-2 rounded border px-2 py-1"
        >
          <option value="">-- Kies --</option>
          {medewerkers?.map((m) => (
            <option key={m.email} value={m.email}>
              {m.naam}
            </option>
          ))}
        </select>
      </label>

      {email && (
        <>
          {geselecteerde && (
            <div className="my-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 font-semibold text-slate-900">
                Planning / inzetbaarheid
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Deze vaardigheden worden gebruikt voor de zomerfeestenplanning.
              </p>

              <div className="grid gap-3 text-sm md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={kanScheppen}
                    onChange={(e) => setKanScheppen(e.target.checked)}
                  />
                  <span>Kan scheppen</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={kanVoorbereiden}
                    onChange={(e) => setKanVoorbereiden(e.target.checked)}
                  />
                  <span>Kan voorbereiden</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={kanIjsbereiden}
                    onChange={(e) => setKanIjsbereiden(e.target.checked)}
                  />
                  <span>Kan ijs bereiden</span>
                </label>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={slaSkillsOp}
                  disabled={skillsOpslaan}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {skillsOpslaan ? "Opslaan..." : "Planning-skills opslaan"}
                </button>

                {skillsSuccess && (
                  <span className="text-sm font-semibold text-green-600">
                    Opgeslagen
                  </span>
                )}
              </div>
            </div>
          )}

          {sollicitatie && (
            <div className="my-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h2 className="mb-3 font-semibold text-blue-900">
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
                  <div className="mt-4">
                    <strong className="text-sm">
                      Opgegeven beschikbaarheid:
                    </strong>
                    <ul className="mt-2 grid list-disc gap-x-6 pl-5 text-sm md:grid-cols-2">
                      {sollicitatie.beschikbaar_momenten.map((moment: string) => (
                        <li key={moment}>{moment}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
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
                <div className="mt-4">
                  <strong className="text-sm">Gespreksnotities:</strong>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-white p-3 text-sm">
                    {sollicitatie.gesprek_notities}
                  </p>
                </div>
              )}

              {sollicitatie.motivatie && (
                <div className="mt-4">
                  <strong className="text-sm">Motivatie / opmerking:</strong>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-white p-3 text-sm">
                    {sollicitatie.motivatie}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="my-4">
            <textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              placeholder="Opmerking toevoegen"
              className="w-full rounded border p-2"
            />
            <button
              onClick={voegToe}
              className="mt-2 rounded bg-blue-500 px-4 py-1 text-white"
            >
              Opslaan
            </button>
            {success && <p className="mt-2 text-green-600">Opgeslagen</p>}
          </div>

          <div className="my-4">
            <input
              id="upload"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={uploadBestand}
              className="ml-2 rounded bg-green-500 px-4 py-1 text-white"
            >
              Upload bestand
            </button>
            {success && <p className="mt-2 text-green-600">Upload voltooid</p>}
          </div>

          {documenten?.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-semibold">Documenten</h2>
              {documenten.map((doc: { bestand_url: string }, i: number) => (
                <div key={i} className="my-2">
                  <button
                    onClick={() => setActieveUrl(doc.bestand_url)}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    📄 Bekijk document
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="my-6">
            <h2 className="mb-2 font-semibold">Ziekteverzuim</h2>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="date"
                value={van}
                onChange={(e) => setVan(e.target.value)}
                className="rounded border px-2 py-1"
              />
              <span>t/m</span>
              <input
                type="date"
                value={tot}
                onChange={(e) => setTot(e.target.value)}
                className="rounded border px-2 py-1"
              />
              <input
                type="text"
                value={opmerkingZiekte}
                onChange={(e) => setOpmerkingZiekte(e.target.value)}
                placeholder="Toelichting"
                className="flex-1 rounded border px-2 py-1"
              />
              <button
                onClick={voegZiekteverzuimToe}
                className="rounded bg-blue-600 px-3 py-1 text-white"
              >
                ➕ Toevoegen
              </button>
            </div>

            {Array.isArray(verzuim) && verzuim.length > 0 && (
              <ul className="mt-2 space-y-2">
                {verzuim.map((v) => (
                  <li
                    key={v.id}
                    className="relative rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm"
                  >
                    {editId === v.id ? (
                      <>
                        <div className="mb-2 flex gap-2">
                          <input
                            type="date"
                            value={editVan}
                            onChange={(e) => setEditVan(e.target.value)}
                            className="rounded border px-2 py-1"
                          />
                          <input
                            type="date"
                            value={editTot || ""}
                            onChange={(e) => setEditTot(e.target.value)}
                            className="rounded border px-2 py-1"
                          />
                        </div>
                        <textarea
                          value={editTekst}
                          onChange={(e) => setEditTekst(e.target.value)}
                          className="w-full rounded border p-1"
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
                          className="mt-1 text-green-600"
                        >
                          💾 Opslaan
                        </button>
                      </>
                    ) : (
                      <p className="text-sm">
                        <strong>{formatDate(v.van)}</strong>
                        {v.tot && v.van !== v.tot && (
                          <>
                            <span> t/m </span>
                            <strong>{formatDate(v.tot)}</strong>
                          </>
                        )}
                        {!v.tot && (
                          <span className="ml-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                            nog ziekgemeld
                          </span>
                        )}
                        <span> – {v.opmerking}</span>
                      </p>
                    )}

                    <div className="absolute right-2 top-2 flex gap-2 text-sm">
                      <button
                        onClick={() => {
                          setEditId(v.id);
                          setEditTekst(v.opmerking);
                          setEditVan(v.van);
                          setEditTot(v.tot);
                        }}
                        className="text-blue-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => verwijderZiekteverzuim(v.id)}
                        className="text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {opmerkingen?.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-semibold">Opmerkingen</h2>
              <div className="space-y-3">
                {opmerkingen.map(
                  (o: { id: number; tekst: string; datum: string }) => (
                    <div
                      key={o.id}
                      className="relative rounded border border-gray-300 bg-gray-100 p-3 shadow-sm"
                    >
                      {editId === o.id ? (
                        <>
                          <textarea
                            value={editTekst}
                            onChange={(e) => setEditTekst(e.target.value)}
                            className="w-full rounded border p-1"
                          />
                          <button
                            onClick={() => bewerkOpmerking(o.id)}
                            className="mt-1 text-green-600"
                          >
                            💾 Opslaan
                          </button>
                        </>
                      ) : (
                        <p className="text-sm">
                          <strong>{formatDate(o.datum)}</strong> – {o.tekst}
                        </p>
                      )}

                      <div className="absolute right-2 top-2 flex gap-2 text-sm">
                        <button
                          onClick={() => {
                            setEditId(o.id);
                            setEditTekst(o.tekst);
                          }}
                          className="text-blue-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => verwijderOpmerking(o.id)}
                          className="text-red-600"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}

      {actieveUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="relative h-[80vh] w-full max-w-3xl rounded bg-white p-4 shadow-lg">
            <button
              onClick={() => setActieveUrl(null)}
              className="absolute right-2 top-2 font-bold text-red-600"
            >
              ✕
            </button>
            {actieveUrl.endsWith(".pdf") ? (
              <iframe
                src={`${actieveUrl}?v=${Date.now()}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                className="h-full w-full rounded"
              />
            ) : (
              <img
                src={actieveUrl}
                alt="Document"
                className="mx-auto max-h-full max-w-full"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}