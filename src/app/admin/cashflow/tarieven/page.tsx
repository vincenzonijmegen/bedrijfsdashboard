"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entity = {
  id: number;
  naam: string;
  type: string;
  actief: boolean;
};

type Stream = {
  id: number;
  naam: string;
  categorie: string;
  van_entiteit_id: number | null;
  van_entiteit: string | null;
  naar_entiteit_id: number | null;
  naar_entiteit: string | null;
  tegenpartij_naam: string | null;
  gedrag: string;
  uitstelbaar: boolean;
  frequentie: string;
  startdatum: string;
  einddatum: string | null;
  actief: boolean;
  berekeningswijze: string | null;
};

type Tariff = {
  id: number;
  stroom_id: number;
  stroom: string;
  geldig_vanaf: string;
  geldig_tot: string | null;
  bedrag: number | string | null;
  percentage_van_bron: number | string | null;
  btw_percentage: number | string | null;
  btw_aftrekbaar_percentage: number | string | null;
  bedrag_is_inclusief_btw: boolean;
};

type CashflowResponse = {
  success: boolean;
  data?: {
    entiteiten: Entity[];
    stromen: Stream[];
    bedragen: Tariff[];
  };
  createdStreamId?: number;
  error?: string;
};

type TariffForm = {
  validFrom: string;
  amount: string;
  vat: string;
  deductible: string;
  inclusive: boolean;
};

type NewStreamForm = {
  name: string;
  category: string;
  frequency: string;
  fromEntityId: string;
  toEntityId: string;
  counterparty: string;
  validFrom: string;
  amount: string;
  vat: string;
  deductible: string;
  inclusive: boolean;
  postponable: boolean;
};

type PlanningOccurrence = {
  entity: string;
  streamId: number;
  streamName: string;
  category: string;
  originalDate: string;
  plannedDate: string;
  amount: number | null;
  status: string;
  postponed: boolean;
  manual: boolean;
  reason: string | null;
  paidOn: string | null;
  planningId: number | null;
};

type PlanningResponse = {
  success: boolean;
  data?: {
    toYear: number;
    occurrences: PlanningOccurrence[];
  };
  error?: string;
};

function money(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}%`;
}

function dateOnly(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null;
}

function formatDate(value: string | null | undefined) {
  const iso = dateOnly(value);
  if (!iso) return "doorlopend";
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

function numberValue(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function monthValue(date: string) {
  return String(date).slice(0, 7);
}

function nextMonthValue(date: string) {
  const [year, month] = monthValue(date).split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function formatMonth(value: string) {
  const [year, month] = monthValue(value).split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export default function CashflowTarievenPage() {
  const [data, setData] = useState<CashflowResponse["data"] | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [form, setForm] = useState<TariffForm>({
    validFrom: "",
    amount: "",
    vat: "0",
    deductible: "0",
    inclusive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingStream, setDeletingStream] = useState(false);
  const [newStreamOpen, setNewStreamOpen] = useState(false);
  const [newStreamSaving, setNewStreamSaving] = useState(false);
  const [newStreamForm, setNewStreamForm] = useState<NewStreamForm>({
    name: "",
    category: "",
    frequency: "",
    fromEntityId: "",
    toEntityId: "",
    counterparty: "",
    validFrom: "",
    amount: "",
    vat: "0",
    deductible: "0",
    inclusive: true,
    postponable: false,
  });
  const [planning, setPlanning] = useState<PlanningResponse["data"] | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [plannedMonths, setPlannedMonths] = useState<Record<string, string>>({});
  const [planningActionKey, setPlanningActionKey] = useState<string | null>(null);
  const [streamModeSaving, setStreamModeSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const planningToYear = new Date().getFullYear() + 3;

  async function load(preferredStreamId?: number | null) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cashflow", { cache: "no-store" });
      const json = (await res.json()) as CashflowResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Tarieven laden mislukt (${res.status})`);
      }

      setData(json.data);

      const fixedStreamIds = new Set(
        json.data.bedragen
          .filter(
            (row) =>
              row.bedrag !== null &&
              row.percentage_van_bron === null
          )
          .map((row) => row.stroom_id)
      );

      const candidates = json.data.stromen.filter(
        (stream) => stream.actief && fixedStreamIds.has(stream.id)
      );

      const nextId =
        preferredStreamId && candidates.some((stream) => stream.id === preferredStreamId)
          ? preferredStreamId
          : selectedStreamId && candidates.some((stream) => stream.id === selectedStreamId)
            ? selectedStreamId
            : candidates[0]?.id ?? null;

      setSelectedStreamId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarieven laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanning() {
    setPlanningLoading(true);
    setPlanningError(null);

    try {
      const res = await fetch(
        `/api/admin/cashflow/planning?tot=${planningToYear}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as PlanningResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          json.error || `Planning laden mislukt (${res.status})`
        );
      }

      setPlanning(json.data);
    } catch (err) {
      setPlanningError(
        err instanceof Error ? err.message : "Planning laden mislukt."
      );
    } finally {
      setPlanningLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadPlanning();
  }, []);

  const fixedStreams = useMemo(() => {
    if (!data) return [];

    const fixedStreamIds = new Set(
      data.bedragen
        .filter(
          (row) =>
            row.bedrag !== null &&
            row.percentage_van_bron === null
        )
        .map((row) => row.stroom_id)
    );

    return data.stromen
      .filter((stream) => stream.actief && fixedStreamIds.has(stream.id))
      .sort((a, b) => {
        const aEntity = a.van_entiteit || "";
        const bEntity = b.van_entiteit || "";
        return aEntity.localeCompare(bEntity, "nl") || a.naam.localeCompare(b.naam, "nl");
      });
  }, [data]);

  const selectedStream =
    fixedStreams.find((stream) => stream.id === selectedStreamId) ?? null;

  const history = useMemo(() => {
    if (!data || !selectedStreamId) return [];
    return data.bedragen
      .filter(
        (row) =>
          row.stroom_id === selectedStreamId &&
          row.bedrag !== null &&
          row.percentage_van_bron === null
      )
      .sort((a, b) =>
        String(b.geldig_vanaf).localeCompare(String(a.geldig_vanaf))
      );
  }, [data, selectedStreamId]);


  const selectedOccurrences = useMemo(() => {
    if (!selectedStreamId || !planning) return [];

    const currentMonth = new Date().toISOString().slice(0, 7);
    return planning.occurrences
      .filter(
        (occurrence) =>
          occurrence.streamId === selectedStreamId &&
          occurrence.status !== "betaald" &&
          occurrence.status !== "vervallen" &&
          (occurrence.postponed ||
            monthValue(occurrence.originalDate) >= currentMonth)
      )
      .sort((a, b) => a.originalDate.localeCompare(b.originalDate));
  }, [planning, selectedStreamId]);

  const activePostponements = useMemo(
    () => selectedOccurrences.filter((occurrence) => occurrence.postponed),
    [selectedOccurrences]
  );

  const activeEntities = useMemo(
    () => (data?.entiteiten ?? []).filter((entity) => entity.actief),
    [data]
  );

  const frequencyOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        (data?.stromen ?? [])
          .filter((stream) => stream.actief && stream.frequentie)
          .map((stream) => stream.frequentie)
      )
    );
    return values.sort((a, b) => a.localeCompare(b, "nl"));
  }, [data]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        (data?.stromen ?? [])
          .filter((stream) => stream.actief && stream.categorie)
          .map((stream) => stream.categorie)
      )
    );
    return values.sort((a, b) => a.localeCompare(b, "nl"));
  }, [data]);

  function openNewStream() {
    const defaultFrequency =
      frequencyOptions.find((value) => value.toLowerCase().includes("maand")) ||
      frequencyOptions[0] ||
      "";

    setNewStreamForm({
      name: "",
      category: "",
      frequency: defaultFrequency,
      fromEntityId: activeEntities[0] ? String(activeEntities[0].id) : "",
      toEntityId: "",
      counterparty: "",
      validFrom: "",
      amount: "",
      vat: "0",
      deductible: "0",
      inclusive: true,
      postponable: false,
    });
    setNewStreamOpen(true);
    setMessage(null);
    setError(null);
  }

  async function saveNewStream(event: FormEvent) {
    event.preventDefault();

    const amount = numberValue(newStreamForm.amount);
    const vat = numberValue(newStreamForm.vat);
    const deductible = numberValue(newStreamForm.deductible);
    const fromEntityId = newStreamForm.fromEntityId
      ? Number(newStreamForm.fromEntityId)
      : null;
    const toEntityId = newStreamForm.toEntityId
      ? Number(newStreamForm.toEntityId)
      : null;

    if (!newStreamForm.name.trim()) {
      setError("Naam is verplicht.");
      return;
    }
    if (!newStreamForm.category.trim()) {
      setError("Categorie is verplicht.");
      return;
    }
    if (!newStreamForm.frequency) {
      setError("Frequentie is verplicht.");
      return;
    }
    if (fromEntityId === null && toEntityId === null) {
      setError("Kies minimaal een van- of naar-entiteit.");
      return;
    }
    if (
      fromEntityId !== null &&
      toEntityId !== null &&
      fromEntityId === toEntityId
    ) {
      setError("Van- en naar-entiteit mogen niet hetzelfde zijn.");
      return;
    }
    if (!newStreamForm.validFrom) {
      setError("Ingangsdatum is verplicht.");
      return;
    }
    const fromEntityName =
      activeEntities.find((entity) => entity.id === fromEntityId)?.naam ?? null;
    if (
      newStreamForm.postponable &&
      fromEntityName === "IJssalon Vincenzo B.V." &&
      newStreamForm.frequency !== "maandelijks"
    ) {
      setError(
        "Uitstelbare vaste stromen van Vincenzo moeten op dit moment maandelijks zijn."
      );
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Bedrag moet 0 of hoger zijn.");
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setError("BTW-percentage moet tussen 0 en 100 liggen.");
      return;
    }
    if (
      !Number.isFinite(deductible) ||
      deductible < 0 ||
      deductible > 100
    ) {
      setError("BTW-aftrek moet tussen 0 en 100 liggen.");
      return;
    }

    const direction =
      fromEntityId !== null && toEntityId !== null
        ? "interne geldstroom"
        : fromEntityId !== null
          ? "uitgaande geldstroom"
          : "inkomende geldstroom";

    if (
      !window.confirm(
        `Je gaat “${newStreamForm.name.trim()}” aanmaken als ${direction} met ${money(amount)} per ${newStreamForm.frequency}, vanaf ${formatDate(newStreamForm.validFrom)}. Dit wijzigt de echte basisprognose. Doorgaan?`
      )
    ) {
      return;
    }

    setNewStreamSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vaste_stroom",
          naam: newStreamForm.name.trim(),
          categorie: newStreamForm.category.trim(),
          frequentie: newStreamForm.frequency,
          van_entiteit_id: fromEntityId,
          naar_entiteit_id: toEntityId,
          tegenpartij_naam: newStreamForm.counterparty.trim() || null,
          uitstelbaar: newStreamForm.postponable,
          geldig_vanaf: newStreamForm.validFrom,
          bedrag: amount,
          btw_percentage: vat,
          btw_aftrekbaar_percentage: deductible,
          bedrag_is_inclusief_btw: newStreamForm.inclusive,
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success || !json.createdStreamId) {
        throw new Error(
          json.error || `Nieuwe geldstroom opslaan mislukt (${res.status})`
        );
      }

      const createdId = json.createdStreamId;
      setNewStreamOpen(false);
      setMessage(
        `${newStreamForm.name.trim()} is toegevoegd aan de vaste geldstromen.`
      );
      await load(createdId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nieuwe geldstroom opslaan mislukt."
      );
    } finally {
      setNewStreamSaving(false);
    }
  }

  function planningKey(occurrence: PlanningOccurrence) {
    return `${occurrence.streamId}-${occurrence.originalDate}`;
  }

  function selectedTargetMonth(occurrence: PlanningOccurrence) {
    const key = planningKey(occurrence);
    return (
      plannedMonths[key] ||
      (occurrence.postponed
        ? monthValue(occurrence.plannedDate)
        : nextMonthValue(occurrence.originalDate))
    );
  }

  function targetMonthCollision(
    occurrence: PlanningOccurrence,
    targetMonth: string
  ) {
    return selectedOccurrences.find(
      (other) =>
        other.streamId === occurrence.streamId &&
        other.originalDate !== occurrence.originalDate &&
        other.status !== "vervallen" &&
        monthValue(other.plannedDate) === targetMonth
    );
  }

  async function enablePostponement() {
    if (!selectedStream) return;

    if (
      selectedStream.van_entiteit === "IJssalon Vincenzo B.V." &&
      selectedStream.frequentie !== "maandelijks"
    ) {
      setPlanningError(
        "Uitstel via Vaste tarieven is voor Vincenzo alleen gekoppeld aan maandelijkse vaste stromen."
      );
      return;
    }

    if (
      !window.confirm(
        `Uitstel inschakelen voor “${selectedStream.naam}”? De geldstroom wordt planbaar; zonder handmatige wijziging blijft iedere betaling gewoon in de oorspronkelijke maand staan.`
      )
    ) {
      return;
    }

    setStreamModeSaving(true);
    setPlanningError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stroom",
          id: selectedStream.id,
          einddatum: selectedStream.einddatum,
          actief: selectedStream.actief,
          uitstelbaar: true,
          gedrag: "planbaar",
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(
          json.error || `Uitstel inschakelen mislukt (${res.status})`
        );
      }

      setMessage(`${selectedStream.naam}: uitstel is ingeschakeld.`);
      await load(selectedStream.id);
      await loadPlanning();
    } catch (err) {
      setPlanningError(
        err instanceof Error ? err.message : "Uitstel inschakelen mislukt."
      );
    } finally {
      setStreamModeSaving(false);
    }
  }

  async function disablePostponement() {
    if (!selectedStream) return;

    if (activePostponements.length > 0) {
      setPlanningError(
        `Zet eerst ${activePostponements.length === 1 ? "de uitgestelde betaling" : `de ${activePostponements.length} uitgestelde betalingen`} terug naar de oorspronkelijke maand voordat je uitstel uitschakelt.`
      );
      return;
    }

    if (
      !window.confirm(
        `Uitstel uitschakelen voor “${selectedStream.naam}”? De betalingsplanning wordt gesloten en de geldstroom wordt weer als vaste betaling verwerkt. Tarieven blijven ongewijzigd.`
      )
    ) {
      return;
    }

    setStreamModeSaving(true);
    setPlanningError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stroom",
          id: selectedStream.id,
          einddatum: selectedStream.einddatum,
          actief: selectedStream.actief,
          uitstelbaar: false,
          gedrag: "vast",
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(
          json.error || `Uitstel uitschakelen mislukt (${res.status})`
        );
      }

      setMessage(`${selectedStream.naam}: uitstel is uitgeschakeld.`);
      setPlannedMonths({});
      await load(selectedStream.id);
      await loadPlanning();
    } catch (err) {
      setPlanningError(
        err instanceof Error ? err.message : "Uitstel uitschakelen mislukt."
      );
    } finally {
      setStreamModeSaving(false);
    }
  }

  async function postponeOccurrence(occurrence: PlanningOccurrence) {
    if (!selectedStream) return;

    const key = planningKey(occurrence);
    const targetMonth = selectedTargetMonth(occurrence);
    const minimumMonth = nextMonthValue(occurrence.originalDate);

    if (!targetMonth || targetMonth < minimumMonth) {
      setPlanningError(
        `Kies een maand vanaf ${formatMonth(`${minimumMonth}-01`)}.`
      );
      return;
    }

    const collision = targetMonthCollision(occurrence, targetMonth);
    if (
      collision &&
      !window.confirm(
        `In ${formatMonth(`${targetMonth}-01`)} staat al een andere betaling van ${selectedStream.naam}. Als je doorgaat, worden beide betalingen in die maand verwerkt. Doorgaan?`
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        `${selectedStream.naam} van ${formatMonth(occurrence.originalDate)} uitstellen naar ${formatMonth(`${targetMonth}-01`)}? Dit werkt direct door in de cashflowprognose.`
      )
    ) {
      return;
    }

    setPlanningActionKey(key);
    setPlanningError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: occurrence.streamId,
          oorspronkelijke_datum: occurrence.originalDate,
          geplande_datum: `${targetMonth}-01`,
          bedrag: occurrence.amount,
          reden: "Handmatig uitgesteld via Vaste tarieven",
        }),
      });

      const json = (await res.json()) as PlanningResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Uitstellen mislukt (${res.status})`);
      }

      setMessage(
        `${selectedStream.naam}: betaling ${formatMonth(occurrence.originalDate)} is uitgesteld naar ${formatMonth(`${targetMonth}-01`)}.`
      );
      await loadPlanning();
    } catch (err) {
      setPlanningError(
        err instanceof Error ? err.message : "Betaling uitstellen mislukt."
      );
    } finally {
      setPlanningActionKey(null);
    }
  }

  async function resetOccurrence(occurrence: PlanningOccurrence) {
    if (!selectedStream) return;

    if (
      !window.confirm(
        `${selectedStream.naam} terugzetten naar ${formatMonth(occurrence.originalDate)}?`
      )
    ) {
      return;
    }

    const key = planningKey(occurrence);
    setPlanningActionKey(key);
    setPlanningError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow/planning", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: occurrence.streamId,
          oorspronkelijke_datum: occurrence.originalDate,
        }),
      });

      const json = (await res.json()) as PlanningResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Terugzetten mislukt (${res.status})`);
      }

      setMessage(
        `${selectedStream.naam}: betaling staat weer in ${formatMonth(occurrence.originalDate)}.`
      );
      await loadPlanning();
    } catch (err) {
      setPlanningError(
        err instanceof Error ? err.message : "Betaling terugzetten mislukt."
      );
    } finally {
      setPlanningActionKey(null);
    }
  }

  function editTariff(row: Tariff) {
    setForm({
      validFrom: dateOnly(row.geldig_vanaf) || "",
      amount: String(row.bedrag ?? ""),
      vat: String(row.btw_percentage ?? 0),
      deductible: String(row.btw_aftrekbaar_percentage ?? 0),
      inclusive: row.bedrag_is_inclusief_btw !== false,
    });
    setMessage(null);
    setError(null);
  }

  function newTariff() {
    const latest = history[0];
    setForm({
      validFrom: "",
      amount: latest?.bedrag != null ? String(latest.bedrag) : "",
      vat: String(latest?.btw_percentage ?? 0),
      deductible: String(latest?.btw_aftrekbaar_percentage ?? 0),
      inclusive: latest?.bedrag_is_inclusief_btw !== false,
    });
    setMessage(null);
    setError(null);
  }

  async function deleteTariff(row: Tariff) {
    if (!selectedStream) return;

    if (history.length <= 1) {
      setError(
        "De laatste tariefregel van een geldstroom kan niet worden verwijderd. Voeg eerst een vervangend tarief toe."
      );
      return;
    }

    if (
      !window.confirm(
        `Tarief van ${selectedStream.naam} vanaf ${formatDate(row.geldig_vanaf)} (${money(row.bedrag)}) verwijderen? De aansluitende tariefperiode wordt automatisch hersteld. Dit werkt direct door in de basisprognose.`
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bedrag",
          id: row.id,
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Verwijderen mislukt (${res.status})`);
      }

      if (dateOnly(row.geldig_vanaf) === form.validFrom) {
        setForm({
          validFrom: "",
          amount: "",
          vat: "0",
          deductible: "0",
          inclusive: true,
        });
      }

      setMessage(
        `${selectedStream.naam}: tarief vanaf ${formatDate(row.geldig_vanaf)} is verwijderd.`
      );
      await load(selectedStream.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarief verwijderen mislukt.");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteStream() {
    if (!selectedStream) return;

    if (
      !window.confirm(
        `Geldstroom “${selectedStream.naam}” volledig verwijderen uit de actieve cashflow? De post verdwijnt uit de vaste tarieven en telt niet meer mee in de prognose. De historische gegevens blijven technisch bewaard.`
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        `Laatste controle: “${selectedStream.naam}” echt verwijderen uit de actieve basisprognose?`
      )
    ) {
      return;
    }

    setDeletingStream(true);
    setError(null);
    setMessage(null);

    try {
      const streamName = selectedStream.naam;
      const res = await fetch("/api/admin/cashflow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stroom",
          id: selectedStream.id,
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Geldstroom verwijderen mislukt (${res.status})`);
      }

      setSelectedStreamId(null);
      setForm({
        validFrom: "",
        amount: "",
        vat: "0",
        deductible: "0",
        inclusive: true,
      });
      setMessage(`${streamName} is verwijderd uit de actieve cashflow en prognose.`);
      await load(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geldstroom verwijderen mislukt.");
    } finally {
      setDeletingStream(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedStream) return;

    const amount = numberValue(form.amount);
    const vat = numberValue(form.vat);
    const deductible = numberValue(form.deductible);

    if (!form.validFrom) {
      setError("Ingangsdatum is verplicht.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Bedrag moet 0 of hoger zijn.");
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setError("BTW-percentage moet tussen 0 en 100 liggen.");
      return;
    }
    if (
      !Number.isFinite(deductible) ||
      deductible < 0 ||
      deductible > 100
    ) {
      setError("BTW-aftrek moet tussen 0 en 100 liggen.");
      return;
    }

    const existingAtDate = history.find(
      (row) => dateOnly(row.geldig_vanaf) === form.validFrom
    );

    const actionText = existingAtDate
      ? `het bestaande tarief van ${selectedStream.naam} per ${formatDate(form.validFrom)} wijzigen naar ${money(amount)}`
      : `een nieuw tarief voor ${selectedStream.naam} vanaf ${formatDate(form.validFrom)} toevoegen van ${money(amount)}`;

    if (
      !window.confirm(
        `Je gaat ${actionText}. Dit wijzigt de echte basisprognose. Doorgaan?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bedrag",
          stroom_id: selectedStream.id,
          geldig_vanaf: form.validFrom,
          bedrag: amount,
          percentage_van_bron: null,
          btw_percentage: vat,
          btw_aftrekbaar_percentage: deductible,
          bedrag_is_inclusief_btw: form.inclusive,
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Opslaan mislukt (${res.status})`);
      }

      setMessage(
        `${selectedStream.naam}: tarief vanaf ${formatDate(form.validFrom)} is opgeslagen.`
      );
      await load(selectedStream.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarief opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Cashflow · fase 4K-B2
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Vaste tarieven
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Beheer bedragen met een ingangsdatum. Bij een nieuw tarief blijft
                het oude tarief historisch intact en wordt de geldigheidsperiode
                automatisch afgesloten.
              </p>
            </div>

            <a
              href="/admin/cashflow/dashboard"
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Terug naar dashboard
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <span className="font-semibold">Dit zijn echte basisgegevens.</span>{" "}
          Wijzigingen werken direct door in de cashflowprognose. Gebruik
          scenario&apos;s voor tijdelijke aannames.
        </section>

        {message && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {message}
          </section>
        )}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            {error}
          </section>
        )}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Tarieven worden geladen…
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Vaste geldstromen
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kies een stroom om de tariefhistorie te bekijken.
              </p>

              <button
                type="button"
                onClick={openNewStream}
                className="mt-4 h-10 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Nieuwe geldstroom
              </button>

              <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {fixedStreams.map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => {
                      setSelectedStreamId(stream.id);
                      setNewStreamOpen(false);
                      setMessage(null);
                      setError(null);
                      setForm({
                        validFrom: "",
                        amount: "",
                        vat: "0",
                        deductible: "0",
                        inclusive: true,
                      });
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedStreamId === stream.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {stream.van_entiteit || "Overig"}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {stream.naam}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {stream.frequentie} · {stream.categorie}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="space-y-5">
              {newStreamOpen && (
                <form
                  onSubmit={saveNewStream}
                  className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        Nieuwe vaste geldstroom
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-slate-900">
                        Geldstroom + eerste tarief
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        De geldstroom en het eerste tarief worden in één keer
                        opgeslagen.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewStreamOpen(false)}
                      disabled={newStreamSaving}
                      className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Annuleren
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Naam *">
                      <input
                        type="text"
                        value={newStreamForm.name}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Bijv. verzekering, software, onderhoud"
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </Field>

                    <Field label="Categorie *">
                      <>
                        <input
                          type="text"
                          list="cashflow-categorieen"
                          value={newStreamForm.category}
                          onChange={(event) =>
                            setNewStreamForm((prev) => ({
                              ...prev,
                              category: event.target.value,
                            }))
                          }
                          placeholder="Bijv. verzekering"
                          className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                        <datalist id="cashflow-categorieen">
                          {categoryOptions.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </>
                    </Field>

                    <Field label="Frequentie *">
                      <select
                        value={newStreamForm.frequency}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            frequency: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Kies frequentie</option>
                        {frequencyOptions.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Van entiteit">
                      <select
                        value={newStreamForm.fromEntityId}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            fromEntityId: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Externe partij / geen entiteit</option>
                        {activeEntities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.naam}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Naar entiteit">
                      <select
                        value={newStreamForm.toEntityId}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            toEntityId: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Externe partij / geen entiteit</option>
                        {activeEntities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.naam}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Tegenpartij">
                      <input
                        type="text"
                        value={newStreamForm.counterparty}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            counterparty: event.target.value,
                          }))
                        }
                        placeholder="Optioneel, bijv. leverancier"
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </Field>

                    <Field label="Geldig vanaf *">
                      <input
                        type="date"
                        value={newStreamForm.validFrom}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            validFrom: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </Field>

                    <Field label="Bedrag *">
                      <MoneyInput
                        value={newStreamForm.amount}
                        onChange={(value) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            amount: value,
                          }))
                        }
                      />
                    </Field>

                    <Field label="BTW">
                      <PercentInput
                        value={newStreamForm.vat}
                        onChange={(value) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            vat: value,
                          }))
                        }
                      />
                    </Field>

                    <Field label="BTW aftrekbaar">
                      <PercentInput
                        value={newStreamForm.deductible}
                        onChange={(value) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            deductible: value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newStreamForm.inclusive}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            inclusive: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Bedrag is inclusief BTW
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newStreamForm.postponable}
                        onChange={(event) =>
                          setNewStreamForm((prev) => ({
                            ...prev,
                            postponable: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Betaling is uitstelbaar
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={newStreamSaving}
                    className="mt-5 h-11 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {newStreamSaving
                      ? "Geldstroom opslaan…"
                      : "Nieuwe geldstroom opslaan"}
                  </button>
                </form>
              )}

              {selectedStream ? (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          {selectedStream.van_entiteit || "Geldstroom"}
                        </div>
                        <h2 className="mt-1 text-2xl font-bold text-slate-900">
                          {selectedStream.naam}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedStream.frequentie} · start{" "}
                          {formatDate(selectedStream.startdatum)}
                        </p>
                        <div className="mt-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              selectedStream.gedrag === "planbaar" &&
                              selectedStream.uitstelbaar
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {selectedStream.gedrag === "planbaar" &&
                            selectedStream.uitstelbaar
                              ? "Uitstelbaar · planbaar"
                              : "Vaste betaling · niet uitstelbaar"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {selectedStream.gedrag === "planbaar" &&
                        selectedStream.uitstelbaar ? (
                          <button
                            type="button"
                            onClick={disablePostponement}
                            disabled={streamModeSaving || deletingStream}
                            className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {streamModeSaving
                              ? "Uitstel uitschakelen…"
                              : "Uitstel uitschakelen"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={enablePostponement}
                            disabled={streamModeSaving || deletingStream}
                            className="h-10 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {streamModeSaving
                              ? "Uitstel inschakelen…"
                              : "Uitstel inschakelen"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={newTariff}
                          disabled={deletingStream}
                          className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Nieuw tarief vanaf datum
                        </button>
                        <button
                          type="button"
                          onClick={deleteStream}
                          disabled={deletingStream || deletingId !== null}
                          className="h-10 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingStream ? "Geldstroom verwijderen…" : "Verwijder geldstroom"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-3">Vanaf</th>
                            <th className="pb-2 pr-3">Tot</th>
                            <th className="pb-2 pr-3 text-right">Bedrag</th>
                            <th className="pb-2 pr-3 text-right">BTW</th>
                            <th className="pb-2 pr-3 text-right">Aftrek</th>
                            <th className="pb-2 text-right">Actie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="py-3 pr-3 font-semibold text-slate-800">
                                {formatDate(row.geldig_vanaf)}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {formatDate(row.geldig_tot)}
                              </td>
                              <td className="py-3 pr-3 text-right font-semibold tabular-nums text-slate-900">
                                {money(row.bedrag)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                                {pct(row.btw_percentage)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                                {pct(row.btw_aftrekbaar_percentage)}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => editTariff(row)}
                                    disabled={deletingId !== null || deletingStream}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Wijzig dit tarief
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTariff(row)}
                                    disabled={deletingId !== null || deletingStream || history.length <= 1}
                                    title={
                                      history.length <= 1
                                        ? "De laatste tariefregel kan niet worden verwijderd"
                                        : "Verwijder deze tariefregel"
                                    }
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {deletingId === row.id ? "Verwijderen…" : "Verwijder"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {planningError && (
                    <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
                      <span className="font-semibold">Uitstelplanning:</span>{" "}
                      {planningError}
                    </section>
                  )}

                  {selectedStream.gedrag === "planbaar" &&
                    selectedStream.uitstelbaar && (
                      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                              Betalingsplanning
                            </div>
                            <h2 className="mt-1 text-xl font-bold text-slate-900">
                              Betaling uitstellen
                            </h2>
                            <p className="mt-1 max-w-3xl text-sm text-slate-500">
                              Alleen deze concrete betaling verschuift. Het vaste
                              tarief en de volgende termijnen blijven ongewijzigd.
                            </p>
                          </div>
                          {activePostponements.length > 0 && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                              {activePostponements.length} uitgesteld
                            </span>
                          )}
                        </div>

                        {planningLoading ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            Betalingen worden geladen…
                          </div>
                        ) : selectedOccurrences.length === 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            Geen toekomstige planbare betalingen gevonden binnen de
                            prognoseperiode.
                          </div>
                        ) : (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[860px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                                  <th className="pb-2 pr-3">Oorspronkelijk</th>
                                  <th className="pb-2 pr-3 text-right">Bedrag</th>
                                  <th className="pb-2 pr-3">Status</th>
                                  <th className="pb-2 pr-3">Uitstellen naar</th>
                                  <th className="pb-2 text-right">Actie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedOccurrences.map((occurrence) => {
                                  const key = planningKey(occurrence);
                                  const targetMonth =
                                    selectedTargetMonth(occurrence);
                                  const collision = targetMonthCollision(
                                    occurrence,
                                    targetMonth
                                  );
                                  const noChange =
                                    occurrence.postponed &&
                                    targetMonth ===
                                      monthValue(occurrence.plannedDate);

                                  return (
                                    <tr
                                      key={key}
                                      className="border-b border-slate-100 last:border-0"
                                    >
                                      <td className="py-3 pr-3 font-semibold text-slate-800">
                                        {formatMonth(occurrence.originalDate)}
                                      </td>
                                      <td className="py-3 pr-3 text-right font-semibold tabular-nums text-slate-900">
                                        {money(occurrence.amount)}
                                      </td>
                                      <td className="py-3 pr-3">
                                        {occurrence.postponed ? (
                                          <div>
                                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                                              Uitgesteld
                                            </span>
                                            <div className="mt-1 text-xs text-slate-500">
                                              Nu:{" "}
                                              {formatMonth(
                                                occurrence.plannedDate
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                            Standaard
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 pr-3">
                                        <input
                                          type="month"
                                          min={nextMonthValue(
                                            occurrence.originalDate
                                          )}
                                          max={`${planningToYear}-12`}
                                          value={targetMonth}
                                          onChange={(event) =>
                                            setPlannedMonths((prev) => ({
                                              ...prev,
                                              [key]: event.target.value,
                                            }))
                                          }
                                          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                                        />
                                        {collision && (
                                          <div className="mt-1 text-xs font-semibold text-amber-700">
                                            In deze maand staat al een andere
                                            termijn.
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                          {occurrence.postponed && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                resetOccurrence(occurrence)
                                              }
                                              disabled={
                                                planningActionKey === key
                                              }
                                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                              Terugzetten
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              postponeOccurrence(occurrence)
                                            }
                                            disabled={
                                              planningActionKey === key ||
                                              !targetMonth ||
                                              noChange
                                            }
                                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {planningActionKey === key
                                              ? "Opslaan…"
                                              : occurrence.postponed
                                                ? "Planning wijzigen"
                                                : "Uitstellen"}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}

                  <form
                    onSubmit={save}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-xl font-bold text-slate-900">
                      Tarief invoeren
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Kies een bestaande ingangsdatum om die tariefregel te
                      wijzigen, of een nieuwe datum om een nieuwe periode te
                      starten.
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Field label="Geldig vanaf *">
                        <input
                          type="date"
                          value={form.validFrom}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              validFrom: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                      </Field>

                      <Field label="Bedrag *">
                        <MoneyInput
                          value={form.amount}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, amount: value }))
                          }
                        />
                      </Field>

                      <Field label="BTW">
                        <PercentInput
                          value={form.vat}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, vat: value }))
                          }
                        />
                      </Field>

                      <Field label="BTW aftrekbaar">
                        <PercentInput
                          value={form.deductible}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              deductible: value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.inclusive}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            inclusive: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Bedrag is inclusief BTW
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="mt-5 h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Opslaan…" : "Tarief opslaan"}
                    </button>
                  </form>
                </>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                  Geen vaste geldstroom gevonden.
                </section>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        €
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 px-3 pr-9 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        %
      </span>
    </div>
  );
}
