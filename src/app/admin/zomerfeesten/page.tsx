"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Euro,
  IceCream,
  Plus,
  Printer,
  Save,
  Timer,
  Trash2,
} from "lucide-react";

type PlanningLijstItem = {
  id: number;
  jaar: number;
  naam: string;
  start_datum: string;
  eind_datum: string;
  omzet_per_dag: string | number;
  percentage_melk: string | number;
  percentage_vruchten: string | number;
  opbrengst_per_bak_melk?: string | number | null;
  opbrengst_per_bak_vrucht?: string | number | null;
  aantal_machines: number;
  kastruimte_bakken: number;
  status: "concept" | "actief" | "afgerond";
  aantal_smaken?: number;
  totaal_bakken?: string | number;
};

type Recept = {
  id: number;
  naam: string;
  categorie?: string | null;
  hoeveelheid_mix?: string | number | null;
};

type KoppelingStatus =
  | "naam_match"
  | "handmatig"
  | "gekoppeld"
  | "ontbreekt_kostprijs"
  | "controle_nodig"
  | "overslaan";

type Smaak = {
  id?: number;
  recept_id: number | null;
  recept_naam?: string | null;
  smaakcode: string;
  smaaknaam: string;
  soort: "melk" | "vrucht" | "overig";
  aantal_bakken: number;
  kleur: string;
  sortering?: number | null;
  kostprijs_recept_id?: number | null;
  kostprijs_recept_naam?: string | null;
  koppeling_status?: KoppelingStatus | null;
  koppeling_opmerking?: string | null;
  doorrekenbaar?: boolean | null;
};

type VitrineNaam = "links" | "midden" | "rechts";
type BewaarkastNaam = "links" | "midden" | "rechts";

type VitrinePositie = {
  planning_id: number;
  vitrine: VitrineNaam;
  positie: number;
  smaakcode: string | null;
};

type VitrineResponse = {
  posities: VitrinePositie[];
};

type BewaarkastPositie = {
  planning_id: number;
  bewaarkast: BewaarkastNaam;
  schap: number;
  smaakcode: string | null;
  aantal_bakken: number;
};

type BewaarkastResponse = {
  posities: BewaarkastPositie[];
};

type DetailResponse = {
  planning: PlanningLijstItem;
  smaken: Smaak[];
};

type IngredientRegel = {
  naam: string;
  eenheid: string;
  hoeveelheid_per_recept: number;
  benodigde_hoeveelheid: number;
  type?: "product" | "tussenrecept";
};

type IngredientControleSmaak = {
  smaakplanning_id: number;
  smaakcode: string;
  smaaknaam: string;
  aantal_bakken: number;
  kostprijs_recept_id: number;
  kostprijs_recept_naam: string;
  opbrengst_bakken: number;
  opbrengst_bron: string;
  factor: number;
  regels: IngredientRegel[];
  waarschuwingen: string[];
};

type IngredientTotaal = {
  naam: string;
  eenheid: string;
  totaal: number;
  bronregels: number;
  product_id?: number | null;
  product_naam?: string | null;
  leverancier_naam?: string | null;
  bestelnummer?: string | null;
  besteleenheid?: number | null;
  huidige_prijs?: number | null;
  verpakking_hoeveelheid?: number | null;
  verpakking_eenheid?: string | null;
};

type BestelAdviesRegel = IngredientTotaal & {
  verpakking_bron: "kolom" | "productnaam" | "ontbreekt";
  verpakking_hoeveelheid_gebruikt: number | null;
  verpakking_eenheid_gebruikt: string | null;
  benodigde_hoeveelheid_in_verpakkingseenheid: number | null;
  bestellen: number | null;
  kosten: number | null;
  status: "berekend" | "controle_nodig";
  melding: string | null;
};

type BestelAdviesLeverancierGroep = {
  leverancier: string;
  regels: BestelAdviesRegel[];
  totaalKosten: number;
  berekend: number;
  controleNodig: number;
};

type TussenreceptControle = {
  naam: string;
  eenheid: string;
  benodigde_hoeveelheid: number;
  recept_id: number | null;
  recept_naam: string | null;
  factor: number | null;
  bronregels: number;
  regels: IngredientRegel[];
  waarschuwingen: string[];
};

type IngredientControleResponse = {
  success: boolean;
  meta: {
    line_table: string | null;
    waarschuwingen?: string[];
    besteladvies_berekend?: number;
    besteladvies_controle_nodig?: number;
    totale_kosten?: number;
  };
  smaken: IngredientControleSmaak[];
  tussenrecepten?: TussenreceptControle[];
  totalen: IngredientTotaal[];
  besteladvies?: BestelAdviesRegel[];
};

type NieuweSmaak = {
  recept_id: number | null;
  smaakcode: string;
  smaaknaam: string;
  soort: "melk" | "vrucht" | "overig";
  aantal_bakken: number;
  kleur: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
};

const todayYear = new Date().getFullYear();
const MINUTEN_PER_BAK_IJS = 15;
const VITRINES: { key: VitrineNaam; label: string }[] = [
  { key: "links", label: "Vitrine links" },
  { key: "midden", label: "Vitrine midden" },
  { key: "rechts", label: "Vitrine rechts" },
];
const VITRINE_POSITIES_PER_VITRINE = 14;
const VITRINE_TOTAAL_MAX = 42;
const BEWAARKASTEN: { key: BewaarkastNaam; label: string; code: string }[] = [
  { key: "links", label: "Bewaar­kast links", code: "L" },
  { key: "midden", label: "Bewaar­kast midden", code: "M" },
  { key: "rechts", label: "Bewaar­kast rechts", code: "R" },
];
const BEWAARKAST_SCHAPPEN = 6;

function normaliseerHexKleur(kleur?: string | null) {
  if (!kleur) return null;
  const value = kleur.trim();
  if (!value.startsWith("#")) return null;

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  if (value.length === 7) {
    return value.toLowerCase();
  }

  return null;
}

function isDonkereKleur(kleur?: string | null) {
  const hex = normaliseerHexKleur(kleur);
  if (!hex) return false;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminantie = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminantie < 0.48;
}


const legePlanning = () => ({
  id: null as number | null,
  jaar: todayYear,
  naam: "Zomerfeesten",
  start_datum: `${todayYear}-07-11`,
  eind_datum: `${todayYear}-07-17`,
  omzet_per_dag: 7500,
  percentage_melk: 65,
  percentage_vruchten: 35,
  opbrengst_per_bak_melk: 90,
  opbrengst_per_bak_vrucht: 80,
  aantal_machines: 3,
  kastruimte_bakken: 50,
  status: "concept" as "concept" | "actief" | "afgerond",
});

const legeNieuweSmaak = (): NieuweSmaak => ({
  recept_id: null,
  smaakcode: "",
  smaaknaam: "",
  soort: "melk",
  aantal_bakken: 0,
  kleur: "#93c5fd",
});

const formatEuro = (waarde: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(waarde || 0);

const formatEuroExact = (waarde: number | null | undefined) =>
  waarde === null || waarde === undefined
    ? "–"
    : new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(waarde || 0);

const formatHoeveelheid = (waarde: number) => {
  if (!Number.isFinite(waarde)) return "0";
  return new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: waarde >= 100 ? 0 : 2,
  }).format(waarde);
};

const datumVoorInput = (waarde?: string) => {
  if (!waarde) return "";
  return waarde.slice(0, 10);
};

const maakCode = (naam: string) =>
  naam
    .slice(0, 4)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const soortUitCategorie = (
  categorie?: string | null,
): "melk" | "vrucht" | "overig" => {
  const tekst = (categorie || "").toLowerCase();
  if (
    tekst.includes("vrucht") ||
    tekst.includes("sorbet") ||
    tekst.includes("fruit")
  ) {
    return "vrucht";
  }
  if (tekst.includes("melk") || tekst.includes("room")) return "melk";
  return "melk";
};

const koppelingLabel = (smaak: Smaak) => {
  if (!smaak.recept_id) return "Geen keukenrecept gekozen";
  if (smaak.doorrekenbaar) return "Doorrekenbaar";
  if (smaak.koppeling_status === "overslaan") return "Overgeslagen";
  if (smaak.koppeling_status === "ontbreekt_kostprijs") return "Later maken";
  if (smaak.koppeling_status === "controle_nodig") return "Controle nodig";
  return "Mist koppeling";
};

const koppelingClassName = (smaak: Smaak) => {
  if (smaak.doorrekenbaar) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (smaak.koppeling_status === "overslaan") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  if (smaak.koppeling_status === "ontbreekt_kostprijs") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
};

export default function ZomerfeestenPage() {
  const { data: planningen } = useSWR<PlanningLijstItem[]>(
    "/api/admin/zomerfeesten/planningen",
    fetcher,
  );
  const { data: recepten, error: receptenError } = useSWR<Recept[]>(
    "/api/admin/zomerfeesten/recepten",
    fetcher,
  );

  const [planning, setPlanning] = useState(legePlanning());
  const [smaken, setSmaken] = useState<Smaak[]>([]);
  const [nieuweSmaak, setNieuweSmaak] =
    useState<NieuweSmaak>(legeNieuweSmaak());
  const [melding, setMelding] = useState<string | null>(null);
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const { data: ingredientenControle, error: ingredientenControleError } =
    useSWR<IngredientControleResponse>(
      planning.id
        ? `/api/admin/zomerfeesten/ingredienten-controle?planning_id=${planning.id}`
        : null,
      fetcher,
    );

  const { data: vitrineData } = useSWR<VitrineResponse>(
    planning.id
      ? `/api/admin/zomerfeesten/vitrine?planning_id=${planning.id}`
      : null,
    fetcher,
  );

  const { data: bewaarkastData } = useSWR<BewaarkastResponse>(
    planning.id
      ? `/api/admin/zomerfeesten/bewaarkast?planning_id=${planning.id}`
      : null,
    fetcher,
  );

  const [vitrineIndeling, setVitrineIndeling] = useState<
    Record<string, string | null>
  >({});
  const [bewaarkastIndeling, setBewaarkastIndeling] = useState<
    Record<string, { smaakcode: string | null; aantal_bakken: number }>
  >({});
  const [dragSmaakcode, setDragSmaakcode] = useState<string | null>(null);
  const [vitrineOpslaanBezig, setVitrineOpslaanBezig] = useState(false);
  const [bewaarkastOpslaanBezig, setBewaarkastOpslaanBezig] = useState(false);
  const [printMode, setPrintMode] = useState<
    null | "bestellijst" | "vitrine" | "bewaarkast"
  >(null);

  useEffect(() => {
    const volgende: Record<string, string | null> = {};

    for (const vitrine of VITRINES) {
      for (
        let positie = 1;
        positie <= VITRINE_POSITIES_PER_VITRINE;
        positie += 1
      ) {
        volgende[`${vitrine.key}-${positie}`] = null;
      }
    }

    for (const positie of vitrineData?.posities ?? []) {
      volgende[`${positie.vitrine}-${positie.positie}`] =
        positie.smaakcode || null;
    }

    setVitrineIndeling(volgende);
  }, [vitrineData]);

  useEffect(() => {
    const volgende: Record<
      string,
      { smaakcode: string | null; aantal_bakken: number }
    > = {};

    for (const kast of BEWAARKASTEN) {
      for (let schap = 1; schap <= BEWAARKAST_SCHAPPEN; schap += 1) {
        volgende[`${kast.key}-${schap}`] = {
          smaakcode: null,
          aantal_bakken: 0,
        };
      }
    }

    for (const positie of bewaarkastData?.posities ?? []) {
      volgende[`${positie.bewaarkast}-${positie.schap}`] = {
        smaakcode: positie.smaakcode || null,
        aantal_bakken: Number(positie.aantal_bakken || 0),
      };
    }

    setBewaarkastIndeling(volgende);
  }, [bewaarkastData]);

  useEffect(() => {
    document.body.classList.remove(
      "print-mode-bestellijst",
      "print-mode-vitrine",
      "print-mode-bewaarkast",
    );

    if (printMode) {
      document.body.classList.add(`print-mode-${printMode}`);
    }

    return () => {
      document.body.classList.remove(
        "print-mode-bestellijst",
        "print-mode-vitrine",
        "print-mode-bewaarkast",
      );
    };
  }, [printMode]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintMode(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const startPrint = (mode: "bestellijst" | "vitrine" | "bewaarkast") => {
    setPrintMode(mode);
    window.setTimeout(() => window.print(), 60);
  };

  const aantalDagen = useMemo(() => {
    const start = new Date(planning.start_datum);
    const eind = new Date(planning.eind_datum);
    if (Number.isNaN(start.getTime()) || Number.isNaN(eind.getTime())) return 0;
    return Math.max(
      0,
      Math.round((eind.getTime() - start.getTime()) / 86400000) + 1,
    );
  }, [planning.start_datum, planning.eind_datum]);

  const totalen = useMemo(() => {
    const melk = smaken
      .filter((s) => s.soort === "melk")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    const vrucht = smaken
      .filter((s) => s.soort === "vrucht")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    const overig = smaken
      .filter((s) => s.soort === "overig")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    return { melk, vrucht, overig, totaal: melk + vrucht + overig };
  }, [smaken]);

  const smaakPerCode = useMemo(() => {
    const map = new Map<string, Smaak>();
    for (const smaak of smaken) {
      const code = smaak.smaakcode?.trim().toUpperCase();
      if (code) map.set(code, smaak);
    }
    return map;
  }, [smaken]);

  const vitrineTellingen = useMemo(() => {
    const tellingen = new Map<string, number>();
    let gevuld = 0;

    for (const smaakcode of Object.values(vitrineIndeling)) {
      if (!smaakcode) continue;
      gevuld += 1;
      tellingen.set(smaakcode, (tellingen.get(smaakcode) || 0) + 1);
    }

    return { gevuld, tellingen };
  }, [vitrineIndeling]);

  const bewaarkastTellingen = useMemo(() => {
    const tellingen = new Map<string, number>();
    let totaalBakken = 0;
    let gevuldeSchappen = 0;

    for (const positie of Object.values(bewaarkastIndeling)) {
      if (!positie.smaakcode) continue;
      gevuldeSchappen += 1;
      const aantal = Number(positie.aantal_bakken || 0);
      totaalBakken += aantal;
      tellingen.set(
        positie.smaakcode,
        (tellingen.get(positie.smaakcode) || 0) + aantal,
      );
    }

    return { tellingen, totaalBakken, gevuldeSchappen };
  }, [bewaarkastIndeling]);

  const koppelingTotalen = useMemo(() => {
    const doorrekenbaar = smaken.filter((s) => s.doorrekenbaar).length;
    const overslaan = smaken.filter(
      (s) => s.koppeling_status === "overslaan",
    ).length;
    const laterMaken = smaken.filter(
      (s) => s.koppeling_status === "ontbreekt_kostprijs",
    ).length;
    const actieNodig = smaken.filter(
      (s) =>
        s.recept_id &&
        !s.doorrekenbaar &&
        s.koppeling_status !== "overslaan" &&
        s.koppeling_status !== "ontbreekt_kostprijs",
    ).length;
    return { doorrekenbaar, overslaan, laterMaken, actieNodig };
  }, [smaken]);

  const besteladviesPerLeverancier = useMemo(() => {
    const advies = ingredientenControle?.besteladvies ?? [];
    const groepen = new Map<string, BestelAdviesLeverancierGroep>();

    for (const regel of advies) {
      const leverancier = regel.leverancier_naam || "Geen leverancier";
      const groep = groepen.get(leverancier) || {
        leverancier,
        regels: [],
        totaalKosten: 0,
        berekend: 0,
        controleNodig: 0,
      };

      groep.regels.push(regel);
      if (regel.status === "berekend") {
        groep.berekend += 1;
        groep.totaalKosten += regel.kosten || 0;
      } else {
        groep.controleNodig += 1;
      }

      groepen.set(leverancier, groep);
    }

    return Array.from(groepen.values()).sort((a, b) => {
      if (a.leverancier === "Geen leverancier") return 1;
      if (b.leverancier === "Geen leverancier") return -1;
      return a.leverancier.localeCompare(b.leverancier, "nl");
    });
  }, [ingredientenControle?.besteladvies]);

  const weekOmzet = Number(planning.omzet_per_dag || 0) * aantalDagen;
  const bakkenPerDag = aantalDagen > 0 ? totalen.totaal / aantalDagen : 0;

  const percentageMelk = Number(planning.percentage_melk || 0);
  const percentageVruchten = Number(planning.percentage_vruchten || 0);
  const opbrengstPerBakMelk = Number(planning.opbrengst_per_bak_melk || 0);
  const opbrengstPerBakVrucht = Number(planning.opbrengst_per_bak_vrucht || 0);
  const omzetMelk = weekOmzet * (percentageMelk / 100);
  const omzetVrucht = weekOmzet * (percentageVruchten / 100);
  const verwachteBakkenMelk =
    opbrengstPerBakMelk > 0 ? Math.ceil(omzetMelk / opbrengstPerBakMelk) : 0;
  const verwachteBakkenVrucht =
    opbrengstPerBakVrucht > 0
      ? Math.ceil(omzetVrucht / opbrengstPerBakVrucht)
      : 0;
  const verwachteBakkenTotaal = verwachteBakkenMelk + verwachteBakkenVrucht;
  const verschilMelk = totalen.melk - verwachteBakkenMelk;
  const verschilVrucht = totalen.vrucht - verwachteBakkenVrucht;
  const verschilTotaal = totalen.totaal - verwachteBakkenTotaal;

  const machinetijdMinutenTotaal = totalen.totaal * MINUTEN_PER_BAK_IJS;
  const machinetijdUrenTotaal = machinetijdMinutenTotaal / 60;
  const aantalMachines = Math.max(1, Number(planning.aantal_machines || 1));
  const productieUrenWeek = machinetijdUrenTotaal / aantalMachines;
  const productieUrenPerDag =
    aantalDagen > 0 ? productieUrenWeek / aantalDagen : 0;
  const bakkenPerMachinePerUur = 60 / MINUTEN_PER_BAK_IJS;
  const capaciteitBakkenPerUur = aantalMachines * bakkenPerMachinePerUur;
  const bakkenPerDagGepland =
    aantalDagen > 0 ? totalen.totaal / aantalDagen : 0;

  const laadPlanning = async (id: number) => {
    setMelding(null);
    const detail: DetailResponse = await fetcher(
      `/api/admin/zomerfeesten/planningen?id=${id}`,
    );

    setPlanning({
      id: detail.planning.id,
      jaar: Number(detail.planning.jaar),
      naam: detail.planning.naam || "Zomerfeesten",
      start_datum: datumVoorInput(detail.planning.start_datum),
      eind_datum: datumVoorInput(detail.planning.eind_datum),
      omzet_per_dag: Number(detail.planning.omzet_per_dag || 0),
      percentage_melk: Number(detail.planning.percentage_melk || 65),
      percentage_vruchten: Number(detail.planning.percentage_vruchten || 35),
      opbrengst_per_bak_melk: Number(
        detail.planning.opbrengst_per_bak_melk || 90,
      ),
      opbrengst_per_bak_vrucht: Number(
        detail.planning.opbrengst_per_bak_vrucht || 80,
      ),
      aantal_machines: Number(detail.planning.aantal_machines || 3),
      kastruimte_bakken: Number(detail.planning.kastruimte_bakken || 50),
      status: detail.planning.status || "concept",
    });

    setSmaken(
      detail.smaken.map((s) => ({
        ...s,
        recept_id: s.recept_id ? Number(s.recept_id) : null,
        kostprijs_recept_id: s.kostprijs_recept_id
          ? Number(s.kostprijs_recept_id)
          : null,
        aantal_bakken: Number(s.aantal_bakken || 0),
        doorrekenbaar: Boolean(s.doorrekenbaar),
        kleur: s.kleur || "#93c5fd",
      })),
    );
  };

  const kiesNieuwRecept = (receptId: number | null) => {
    const recept = recepten?.find((r) => r.id === receptId);
    setNieuweSmaak((prev) => ({
      ...prev,
      recept_id: receptId,
      smaaknaam: recept?.naam || prev.smaaknaam,
      smaakcode: prev.smaakcode || maakCode(recept?.naam || ""),
      soort: soortUitCategorie(recept?.categorie),
    }));
  };

  const voegSmaakToe = () => {
    const smaaknaam = nieuweSmaak.smaaknaam.trim();
    const smaakcode = nieuweSmaak.smaakcode.trim().toUpperCase();

    if (!smaaknaam || !smaakcode) {
      setMelding("Kies een recept of vul minimaal een smaaknaam en code in.");
      return;
    }

    setSmaken((prev) => [
      ...prev,
      {
        recept_id: nieuweSmaak.recept_id,
        smaakcode,
        smaaknaam,
        soort: nieuweSmaak.soort,
        aantal_bakken: Number(nieuweSmaak.aantal_bakken || 0),
        kleur: nieuweSmaak.kleur || "#93c5fd",
        sortering: prev.length + 1,
      },
    ]);
    setNieuweSmaak(legeNieuweSmaak());
    setMelding(null);
  };

  const wijzigSmaak = (index: number, patch: Partial<Smaak>) => {
    setSmaken((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        return { ...s, ...patch };
      }),
    );
  };

  const kiesBestaandRecept = (index: number, receptId: number | null) => {
    const recept = recepten?.find((r) => r.id === receptId);
    wijzigSmaak(index, {
      recept_id: receptId,
      smaaknaam: recept?.naam || smaken[index]?.smaaknaam || "",
      smaakcode: smaken[index]?.smaakcode || maakCode(recept?.naam || ""),
      soort: recept
        ? soortUitCategorie(recept.categorie)
        : smaken[index]?.soort || "melk",
      kostprijs_recept_id: null,
      kostprijs_recept_naam: null,
      koppeling_status: null,
      doorrekenbaar: null,
    });
  };

  const opslaan = async () => {
    setOpslaanBezig(true);
    setMelding(null);

    try {
      const res = await fetch("/api/admin/zomerfeesten/planningen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...planning, smaken }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Opslaan mislukt");

      setPlanning((prev) => ({ ...prev, id: json.id }));
      setMelding("Zomerfeestenplanning opgeslagen.");
      mutate("/api/admin/zomerfeesten/planningen");
      await laadPlanning(json.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Opslaan mislukt";
      setMelding(message);
    } finally {
      setOpslaanBezig(false);
    }
  };

  const verwijderPlanning = async () => {
    if (!planning.id) return;
    if (!confirm(`Zomerfeestenplanning ${planning.jaar} verwijderen?`)) return;

    const res = await fetch(
      `/api/admin/zomerfeesten/planningen?id=${planning.id}`,
      { method: "DELETE" },
    );

    if (res.ok) {
      setPlanning(legePlanning());
      setSmaken([]);
      mutate("/api/admin/zomerfeesten/planningen");
      setMelding("Planning verwijderd.");
    }
  };

  const zetVitrinePositie = (
    vitrine: VitrineNaam,
    positie: number,
    smaakcode: string | null,
  ) => {
    setVitrineIndeling((prev) => ({
      ...prev,
      [`${vitrine}-${positie}`]: smaakcode,
    }));
  };

  const opslaanVitrine = async () => {
    if (!planning.id) {
      setMelding(
        "Sla eerst de Zomerfeestenplanning op voordat je de vitrine-indeling opslaat.",
      );
      return;
    }

    setVitrineOpslaanBezig(true);
    setMelding(null);

    try {
      const posities = VITRINES.flatMap((vitrine) =>
        Array.from({ length: VITRINE_POSITIES_PER_VITRINE }, (_, index) => {
          const positie = index + 1;
          return {
            vitrine: vitrine.key,
            positie,
            smaakcode: vitrineIndeling[`${vitrine.key}-${positie}`] || null,
          };
        }),
      );

      const res = await fetch("/api/admin/zomerfeesten/vitrine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planning_id: planning.id, posities }),
      });

      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Vitrine-indeling opslaan mislukt");

      setMelding("Vitrine-indeling opgeslagen.");
      mutate(`/api/admin/zomerfeesten/vitrine?planning_id=${planning.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Vitrine-indeling opslaan mislukt";
      setMelding(message);
    } finally {
      setVitrineOpslaanBezig(false);
    }
  };

  const zetBewaarkastSmaak = (
    bewaarkast: BewaarkastNaam,
    schap: number,
    smaakcode: string | null,
  ) => {
    setBewaarkastIndeling((prev) => {
      const key = `${bewaarkast}-${schap}`;
      const huidige = prev[key] || { smaakcode: null, aantal_bakken: 0 };
      return {
        ...prev,
        [key]: {
          smaakcode,
          aantal_bakken: smaakcode
            ? Math.max(1, Number(huidige.aantal_bakken || 1))
            : 0,
        },
      };
    });
  };

  const zetBewaarkastAantal = (
    bewaarkast: BewaarkastNaam,
    schap: number,
    aantal_bakken: number,
  ) => {
    setBewaarkastIndeling((prev) => {
      const key = `${bewaarkast}-${schap}`;
      const huidige = prev[key] || { smaakcode: null, aantal_bakken: 0 };
      return {
        ...prev,
        [key]: {
          ...huidige,
          aantal_bakken: Math.max(0, Number(aantal_bakken || 0)),
        },
      };
    });
  };

  const opslaanBewaarkast = async () => {
    if (!planning.id) {
      setMelding(
        "Sla eerst de Zomerfeestenplanning op voordat je de bewaarkastindeling opslaat.",
      );
      return;
    }

    setBewaarkastOpslaanBezig(true);
    setMelding(null);

    try {
      const posities = BEWAARKASTEN.flatMap((kast) =>
        Array.from({ length: BEWAARKAST_SCHAPPEN }, (_, index) => {
          const schap = index + 1;
          const positie = bewaarkastIndeling[`${kast.key}-${schap}`] || {
            smaakcode: null,
            aantal_bakken: 0,
          };
          return {
            bewaarkast: kast.key,
            schap,
            smaakcode: positie.smaakcode || null,
            aantal_bakken: Number(positie.aantal_bakken || 0),
          };
        }),
      );

      const res = await fetch("/api/admin/zomerfeesten/bewaarkast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planning_id: planning.id, posities }),
      });

      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Bewaar­kastindeling opslaan mislukt");

      setMelding("Bewaar­kastindeling opgeslagen.");
      mutate(`/api/admin/zomerfeesten/bewaarkast?planning_id=${planning.id}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Bewaar­kastindeling opslaan mislukt";
      setMelding(message);
    } finally {
      setBewaarkastOpslaanBezig(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          body.print-mode-bestellijst .print-only-bestellijst,
          body.print-mode-bestellijst .print-only-bestellijst *,
          body.print-mode-vitrine .print-only-vitrine,
          body.print-mode-vitrine .print-only-vitrine *,
          body.print-mode-bewaarkast .print-only-bewaarkast,
          body.print-mode-bewaarkast .print-only-bewaarkast * {
            visibility: visible !important;
          }

          .print-only-bestellijst,
          .print-only-vitrine,
          .print-only-bewaarkast {
            display: none !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #0f172a !important;
            background: white !important;
          }

          body.print-mode-bestellijst .print-only-bestellijst,
          body.print-mode-vitrine .print-only-vitrine,
          body.print-mode-bewaarkast .print-only-bewaarkast {
            display: block !important;
          }

          .print-sheet {
            color: #0f172a !important;
            background: white !important;
            font-size: 9.5pt !important;
            line-height: 1.25 !important;
          }

          .print-sheet h1 {
            margin: 0 0 3mm 0 !important;
            font-size: 16pt !important;
            line-height: 1.15 !important;
          }

          .print-meta {
            margin-bottom: 5mm !important;
            display: flex !important;
            justify-content: space-between !important;
            gap: 10mm !important;
            color: #475569 !important;
            font-size: 9pt !important;
          }

          .print-total {
            margin: 0 0 6mm 0 !important;
            padding: 3mm !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 0 !important;
            font-size: 11pt !important;
            font-weight: 700 !important;
          }

          .print-leverancier {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin: 0 0 7mm 0 !important;
          }

          .print-leverancier-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: baseline !important;
            margin: 0 0 2mm 0 !important;
            padding-bottom: 1.5mm !important;
            border-bottom: 1px solid #94a3b8 !important;
          }

          .print-leverancier-header h2 {
            margin: 0 !important;
            font-size: 12pt !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          .print-table th {
            padding: 1.6mm 1.5mm !important;
            border-bottom: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
            color: #334155 !important;
            font-size: 8pt !important;
            text-align: left !important;
          }

          .print-table td {
            padding: 1.7mm 1.5mm !important;
            border-bottom: 1px solid #e2e8f0 !important;
            vertical-align: top !important;
            font-size: 8.5pt !important;
          }

          .print-table .num {
            text-align: right !important;
            white-space: nowrap !important;
          }

          .print-product {
            font-weight: 600 !important;
          }

          .print-subtle {
            color: #64748b !important;
            font-size: 8pt !important;
          }

          .print-note {
            color: #92400e !important;
            font-size: 8pt !important;
          }

          .print-grandtotal {
            margin-top: 4mm !important;
            padding-top: 3mm !important;
            border-top: 2px solid #0f172a !important;
            display: flex !important;
            justify-content: space-between !important;
            font-size: 12pt !important;
            font-weight: 800 !important;
          }

          .print-layout-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 5mm !important;
            align-items: start !important;
          }

          .print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 4mm !important;
            overflow: hidden !important;
            background: white !important;
          }

          .print-card-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 3mm 4mm !important;
            background: #e0f2fe !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }

          .print-card-header h2 {
            margin: 0 !important;
            font-size: 12pt !important;
            font-weight: 800 !important;
          }

          .print-pill {
            border: 1px solid #cbd5e1 !important;
            border-radius: 999px !important;
            padding: 1mm 2mm !important;
            font-size: 8pt !important;
            font-weight: 700 !important;
            color: #475569 !important;
            background: white !important;
          }

          .print-vitrine-grid {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 2.2mm !important;
            padding: 4mm !important;
          }

          .print-vak {
            min-height: 32mm !important;
            border: 1px solid rgba(15, 23, 42, 0.15) !important;
            border-radius: 4mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
            overflow: hidden !important;
            font-weight: 800 !important;
          }

          .print-vak-code {
            transform: rotate(-90deg) !important;
            white-space: nowrap !important;
            font-size: 11pt !important;
            letter-spacing: 0.02em !important;
          }

          .print-vak-pos {
            position: absolute !important;
            right: 2mm !important;
            bottom: 1.8mm !important;
            min-width: 5.5mm !important;
            height: 5.5mm !important;
            border-radius: 999px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 7.5pt !important;
            font-weight: 800 !important;
          }

          .print-bewaarkast-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .print-bewaarkast-table th,
          .print-bewaarkast-table td {
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 2.4mm 2.6mm !important;
            font-size: 9pt !important;
          }

          .print-bewaarkast-table th {
            background: #f8fafc !important;
            color: #334155 !important;
            text-align: left !important;
            font-size: 8pt !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
          }

          .print-bewaarkast-smaak {
            font-weight: 700 !important;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Zomerfeesten</p>
              <h1 className="text-2xl font-bold text-slate-900">
                Planning & smaakplanning
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Eerste bouwblok: jaargang aanmaken en aantal bakken per smaak
                vastleggen.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlanning(legePlanning());
                  setSmaken([]);
                  setNieuweSmaak(legeNieuweSmaak());
                  setMelding(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Nieuwe planning
              </button>
              <button
                type="button"
                onClick={opslaan}
                disabled={opslaanBezig}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {opslaanBezig ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>

          {melding && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {melding}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Bestaande planningen
              </h2>

              <div className="space-y-2">
                {(planningen ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => laadPlanning(p.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      planning.id === p.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">
                        {p.naam} {p.jaar}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {Number(p.aantal_smaken || 0)} smaken ·{" "}
                      {Number(p.totaal_bakken || 0)} bakken
                    </div>
                  </button>
                ))}

                {planningen?.length === 0 && (
                  <p className="text-sm text-slate-500">Nog geen planningen.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Samenvatting
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Dagen</span>
                  <span className="font-semibold text-slate-900">
                    {aantalDagen}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Weekomzet</span>
                  <span className="font-semibold text-slate-900">
                    {formatEuro(weekOmzet)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Melk</span>
                  <span className="font-semibold text-slate-900">
                    {totalen.melk}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vrucht</span>
                  <span className="font-semibold text-slate-900">
                    {totalen.vrucht}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Totaal bakken</span>
                  <span className="font-bold text-slate-900">
                    {totalen.totaal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Bakken per dag</span>
                  <span className="font-semibold text-slate-900">
                    {bakkenPerDag.toFixed(1)}
                  </span>
                </div>
              </div>
            </section>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Planninggegevens
                </h2>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Basis
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Jaar</span>
                      <input
                        type="number"
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={planning.jaar}
                        onChange={(e) =>
                          setPlanning((p) => ({
                            ...p,
                            jaar: Number(e.target.value),
                          }))
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Naam</span>
                      <input
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={planning.naam}
                        onChange={(e) =>
                          setPlanning((p) => ({ ...p, naam: e.target.value }))
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Startdatum</span>
                      <input
                        type="date"
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={planning.start_datum}
                        onChange={(e) =>
                          setPlanning((p) => ({
                            ...p,
                            start_datum: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Einddatum</span>
                      <input
                        type="date"
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={planning.eind_datum}
                        onChange={(e) =>
                          setPlanning((p) => ({ ...p, eind_datum: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Omzet & verdeling
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="font-medium text-slate-700">Omzet per dag</span>
                        <div className="relative">
                          <Euro className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="number"
                            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3"
                            value={planning.omzet_per_dag}
                            onChange={(e) =>
                              setPlanning((p) => ({
                                ...p,
                                omzet_per_dag: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">% melk</span>
                        <input
                          type="number"
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={planning.percentage_melk}
                          onChange={(e) =>
                            setPlanning((p) => ({
                              ...p,
                              percentage_melk: Number(e.target.value),
                            }))
                          }
                        />
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">% vruchten</span>
                        <input
                          type="number"
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={planning.percentage_vruchten}
                          onChange={(e) =>
                            setPlanning((p) => ({
                              ...p,
                              percentage_vruchten: Number(e.target.value),
                            }))
                          }
                        />
                      </label>

                      <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="font-medium text-slate-700">Status</span>
                        <select
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={planning.status}
                          onChange={(e) =>
                            setPlanning((p) => ({
                              ...p,
                              status: e.target.value as
                                | "concept"
                                | "actief"
                                | "afgerond",
                            }))
                          }
                        >
                          <option value="concept">Concept</option>
                          <option value="actief">Actief</option>
                          <option value="afgerond">Afgerond</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Bakken & capaciteit
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Opbrengst/bak melk</span>
                        <div className="relative">
                          <Euro className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="number"
                            className="w-full min-w-0 rounded-xl border border-slate-200 py-2 pl-9 pr-3"
                            value={planning.opbrengst_per_bak_melk}
                            onChange={(e) =>
                              setPlanning((p) => ({
                                ...p,
                                opbrengst_per_bak_melk: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Opbrengst/bak vrucht</span>
                        <div className="relative">
                          <Euro className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="number"
                            className="w-full min-w-0 rounded-xl border border-slate-200 py-2 pl-9 pr-3"
                            value={planning.opbrengst_per_bak_vrucht}
                            onChange={(e) =>
                              setPlanning((p) => ({
                                ...p,
                                opbrengst_per_bak_vrucht: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Machines</span>
                        <input
                          type="number"
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={planning.aantal_machines}
                          onChange={(e) =>
                            setPlanning((p) => ({
                              ...p,
                              aantal_machines: Number(e.target.value),
                            }))
                          }
                        />
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Kastruimte bakken</span>
                        <input
                          type="number"
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={planning.kastruimte_bakken}
                          onChange={(e) =>
                            setPlanning((p) => ({
                              ...p,
                              kastruimte_bakken: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Euro className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Omzetprognose naar bakken
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Weekomzet</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatEuro(weekOmzet)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {aantalDagen} dagen ×{" "}
                  {formatEuro(Number(planning.omzet_per_dag || 0))}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">Melkijs</p>
                <p className="mt-1 text-sm text-blue-800">
                  {percentageMelk}% van de omzet = {formatEuro(omzetMelk)}
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-950">
                  {verwachteBakkenMelk} bakken
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  gerekend met {formatEuro(opbrengstPerBakMelk)} per bak
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Vruchtenijs
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  {percentageVruchten}% van de omzet = {formatEuro(omzetVrucht)}
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">
                  {verwachteBakkenVrucht} bakken
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  gerekend met {formatEuro(opbrengstPerBakVrucht)} per bak
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Onderdeel</th>
                    <th className="px-4 py-3 text-right">Prognose</th>
                    <th className="px-4 py-3 text-right">Gepland</th>
                    <th className="px-4 py-3 text-right">Verschil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    {
                      label: "Melk",
                      verwacht: verwachteBakkenMelk,
                      gepland: totalen.melk,
                      verschil: verschilMelk,
                    },
                    {
                      label: "Vrucht",
                      verwacht: verwachteBakkenVrucht,
                      gepland: totalen.vrucht,
                      verschil: verschilVrucht,
                    },
                    {
                      label: "Totaal",
                      verwacht: verwachteBakkenTotaal,
                      gepland: totalen.totaal,
                      verschil: verschilTotaal,
                    },
                  ].map((rij) => (
                    <tr key={rij.label}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {rij.label}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {rij.verwacht}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {rij.gepland}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          rij.verschil === 0
                            ? "text-slate-500"
                            : rij.verschil > 0
                              ? "text-emerald-700"
                              : "text-amber-700"
                        }`}
                      >
                        {rij.verschil > 0 ? "+" : ""}
                        {rij.verschil}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Dit is een planningscontrole. De app past aantallen per smaak nog
              niet automatisch aan.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Productietijd & machines
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Machinetijd per bak</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {MINUTEN_PER_BAK_IJS} min
                </p>
                <p className="mt-1 text-xs text-slate-500">vaste aanname</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Machines</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {aantalMachines}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatHoeveelheid(capaciteitBakkenPerUur)} bakken per uur
                  samen
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Totaal machinetijd
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {formatHoeveelheid(machinetijdUrenTotaal)} uur
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  {totalen.totaal} bakken × {MINUTEN_PER_BAK_IJS} minuten
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Benodigde draaitijd
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {formatHoeveelheid(productieUrenPerDag)} uur/dag
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  bij {aantalMachines} machine{aantalMachines === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Onderdeel</th>
                    <th className="px-4 py-3 text-right">Waarde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Geplande bakken per dag
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatHoeveelheid(bakkenPerDagGepland)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Machinecapaciteit per uur
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatHoeveelheid(capaciteitBakkenPerUur)} bakken
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Benodigde draaitijd per dag
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatHoeveelheid(productieUrenPerDag)} uur
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Benodigde draaitijd hele periode
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatHoeveelheid(productieUrenWeek)} uur kloktijd met{" "}
                      {aantalMachines} machine{aantalMachines === 1 ? "" : "s"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Rekenregel: iedere geplande bak vraagt {MINUTEN_PER_BAK_IJS}{" "}
              minuten machinetijd. Met meerdere machines wordt de benodigde
              kloktijd gedeeld door het aantal machines.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <IceCream className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Smaakplanning
              </h2>
            </div>

            {receptenError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Keukenrecepten konden niet worden opgehaald. Controleer de
                API-route of tabelnaam.
              </div>
            )}

            {!receptenError && recepten && recepten.length === 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Er zijn nog geen actieve keukenrecepten gevonden om te koppelen.
              </div>
            )}

            {smaken.length > 0 && koppelingTotalen.actieNodig > 0 && (
              <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  {koppelingTotalen.actieNodig} smaak/smaken hebben nog geen
                  bruikbare kostprijskoppeling. Controleer dit bij
                  Receptkoppelingen voordat we later bestellijsten of
                  kostprijzen berekenen.
                </div>
              </div>
            )}

            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Smaak toevoegen
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_120px_minmax(190px,1.5fr)_120px_110px]">
                <label className="min-w-0 space-y-1 text-sm md:col-span-2 xl:col-span-1">
                  <span className="font-medium text-slate-700">
                    Keukenrecept
                  </span>
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={nieuweSmaak.recept_id ?? ""}
                    onChange={(e) =>
                      kiesNieuwRecept(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">-- kies keukenrecept --</option>
                    {(recepten ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.categorie ? `${r.categorie} · ` : ""}
                        {r.naam}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Code</span>
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 uppercase"
                    value={nieuweSmaak.smaakcode}
                    onChange={(e) =>
                      setNieuweSmaak((s) => ({
                        ...s,
                        smaakcode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </label>

                <label className="min-w-0 space-y-1 text-sm md:col-span-2 xl:col-span-1">
                  <span className="font-medium text-slate-700">Smaaknaam</span>
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={nieuweSmaak.smaaknaam}
                    onChange={(e) =>
                      setNieuweSmaak((s) => ({
                        ...s,
                        smaaknaam: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Soort</span>
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={nieuweSmaak.soort}
                    onChange={(e) =>
                      setNieuweSmaak((s) => ({
                        ...s,
                        soort: e.target.value as "melk" | "vrucht" | "overig",
                      }))
                    }
                  >
                    <option value="melk">Melk</option>
                    <option value="vrucht">Vrucht</option>
                    <option value="overig">Overig</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Bakken</span>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right"
                    value={nieuweSmaak.aantal_bakken}
                    onChange={(e) =>
                      setNieuweSmaak((s) => ({
                        ...s,
                        aantal_bakken: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <div className="flex min-w-0 flex-wrap items-end gap-3 md:col-span-2 xl:col-span-5">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Kleur</span>
                    <input
                      type="color"
                      className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                      value={nieuweSmaak.kleur || "#93c5fd"}
                      onChange={(e) =>
                        setNieuweSmaak((s) => ({ ...s, kleur: e.target.value }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    onClick={voegSmaakToe}
                    className="mb-0 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" /> Toevoegen
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {smaken.map((smaak, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(170px,1.2fr)_78px_minmax(135px,1fr)_96px_78px_74px_86px] xl:items-end">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">
                        Keukenrecept
                      </span>
                      <select
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={smaak.recept_id ?? ""}
                        onChange={(e) =>
                          kiesBestaandRecept(
                            index,
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">-- kies keukenrecept --</option>
                        {(recepten ?? []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.categorie ? `${r.categorie} · ` : ""}
                            {r.naam}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Code</span>
                      <input
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 uppercase"
                        value={smaak.smaakcode}
                        onChange={(e) =>
                          wijzigSmaak(index, {
                            smaakcode: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">
                        Smaaknaam
                      </span>
                      <input
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={smaak.smaaknaam}
                        onChange={(e) =>
                          wijzigSmaak(index, { smaaknaam: e.target.value })
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Soort</span>
                      <select
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                        value={smaak.soort}
                        onChange={(e) =>
                          wijzigSmaak(index, {
                            soort: e.target.value as
                              | "melk"
                              | "vrucht"
                              | "overig",
                          })
                        }
                      >
                        <option value="melk">Melk</option>
                        <option value="vrucht">Vrucht</option>
                        <option value="overig">Overig</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Bakken</span>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-right"
                        value={smaak.aantal_bakken}
                        onChange={(e) =>
                          wijzigSmaak(index, {
                            aantal_bakken: Number(e.target.value),
                          })
                        }
                      />
                    </label>

                    <div className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">
                        Per dag
                      </span>
                      <div className="rounded-xl bg-slate-50 px-2 py-2 text-right font-semibold text-slate-700">
                        {aantalDagen > 0
                          ? (
                              Number(smaak.aantal_bakken || 0) / aantalDagen
                            ).toFixed(1)
                          : "-"}
                      </div>
                    </div>

                    <div className="flex min-w-0 items-end gap-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">
                          Kleur
                        </span>
                        <input
                          type="color"
                          className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                          value={smaak.kleur || "#93c5fd"}
                          onChange={(e) =>
                            wijzigSmaak(index, { kleur: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSmaken((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        className="mb-0 shrink-0 rounded-xl p-3 text-red-600 hover:bg-red-50"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 text-sm ${koppelingClassName(
                      smaak,
                    )}`}
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <span className="font-semibold">
                        Calculatie: {koppelingLabel(smaak)}
                      </span>
                      {smaak.kostprijs_recept_naam && (
                        <span className="text-xs md:text-sm">
                          Kostprijsrecept: {smaak.kostprijs_recept_naam}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {smaken.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Nog geen smaken toegevoegd.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Check className="h-4 w-4 text-emerald-600" />
                Totaal: {totalen.totaal} bakken
              </div>
              <div className="text-slate-600">
                Melk {totalen.melk} · Vrucht {totalen.vrucht} · Overig{" "}
                {totalen.overig}
              </div>
              <div className="text-xs text-slate-500 md:basis-full">
                Doorrekenbaar {koppelingTotalen.doorrekenbaar} · Later maken{" "}
                {koppelingTotalen.laterMaken} · Overslaan{" "}
                {koppelingTotalen.overslaan} · Actie nodig{" "}
                {koppelingTotalen.actieNodig}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Vitrine-indeling
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sleep smaken naar de drie vitrines. Elke vitrine heeft 2 rijen
                  van 7 bakken; samen maximaal {VITRINE_TOTAAL_MAX} bakken.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => startPrint("vitrine")}
                  disabled={!planning.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  Print vitrines
                </button>
                <button
                  type="button"
                  onClick={opslaanVitrine}
                  disabled={!planning.id || vitrineOpslaanBezig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {vitrineOpslaanBezig ? "Opslaan..." : "Vitrine opslaan"}
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-semibold text-slate-900">
                  Gevuld: {vitrineTellingen.gevuld} / {VITRINE_TOTAAL_MAX}{" "}
                  bakken
                </div>
                <div className="text-slate-500">
                  Sleep vanuit deze lijst naar een vak, of sleep een gevuld vak
                  naar een andere plek.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {smaken.map((smaak) => {
                  const code = smaak.smaakcode?.trim().toUpperCase();
                  if (!code) return null;
                  const inVitrine = vitrineTellingen.tellingen.get(code) || 0;

                  return (
                    <button
                      key={`vitrine-palette-${code}`}
                      type="button"
                      draggable
                      onDragStart={() => setDragSmaakcode(code)}
                      onDragEnd={() => setDragSmaakcode(null)}
                      className="inline-flex cursor-grab items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm active:cursor-grabbing"
                      title="Sleep naar de vitrine"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-slate-300"
                        style={{ backgroundColor: smaak.kleur || "#93c5fd" }}
                      />
                      <span>{smaak.smaaknaam}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {inVitrine} in vitrine
                      </span>
                    </button>
                  );
                })}

                {smaken.length === 0 && (
                  <div className="text-sm text-slate-500">
                    Voeg eerst smaken toe aan de smaakplanning.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {VITRINES.map((vitrine) => (
                <div
                  key={vitrine.key}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">
                      {vitrine.label}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {
                        Array.from({
                          length: VITRINE_POSITIES_PER_VITRINE,
                        }).filter((_, index) =>
                          Boolean(
                            vitrineIndeling[`${vitrine.key}-${index + 1}`],
                          ),
                        ).length
                      }{" "}
                      / {VITRINE_POSITIES_PER_VITRINE}
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {Array.from(
                      { length: VITRINE_POSITIES_PER_VITRINE },
                      (_, index) => {
                        const positie = index + 1;
                        const key = `${vitrine.key}-${positie}`;
                        const smaakcode = vitrineIndeling[key] || null;
                        const smaak = smaakcode
                          ? smaakPerCode.get(smaakcode)
                          : null;
                        const donkereSmaakKleur = isDonkereKleur(
                          smaak?.kleur || null,
                        );

                        return (
                          <div
                            key={key}
                            draggable={Boolean(smaakcode)}
                            onDragStart={() =>
                              smaakcode && setDragSmaakcode(smaakcode)
                            }
                            onDragEnd={() => setDragSmaakcode(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragSmaakcode)
                                zetVitrinePositie(
                                  vitrine.key,
                                  positie,
                                  dragSmaakcode,
                                );
                            }}
                            className={`group relative flex min-h-[80px] items-center justify-center overflow-hidden rounded-xl border p-1 text-center text-[11px] font-bold leading-tight transition ${
                              smaak
                                ? "cursor-grab border-slate-300 shadow-sm active:cursor-grabbing"
                                : "border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-300 hover:bg-blue-50"
                            }`}
                            style={
                              smaak
                                ? {
                                    backgroundColor: smaak.kleur || "#bfdbfe",
                                    color: donkereSmaakKleur ? "#ffffff" : "#0f172a",
                                  }
                                : undefined
                            }
                            title={
                              smaak
                                ? `${positie}. ${smaak.smaaknaam}`
                                : `Positie ${positie}`
                            }
                          >
                            {smaak ? (
                              <>
                                <span
                                  className="pointer-events-none select-none whitespace-nowrap text-[13px] font-black tracking-tight drop-shadow-sm"
                                  style={{ transform: "rotate(-90deg)" }}
                                >
                                  {smaak.smaakcode || smaak.smaaknaam}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    zetVitrinePositie(
                                      vitrine.key,
                                      positie,
                                      null,
                                    );
                                  }}
                                  className={`absolute right-1 top-1 hidden rounded-full px-1 text-[10px] font-bold shadow-sm group-hover:block ${
                                    donkereSmaakKleur
                                      ? "bg-black/25 text-white"
                                      : "bg-white/80 text-slate-700"
                                  }`}
                                  title="Vak leegmaken"
                                >
                                  ×
                                </button>
                                <span className={`absolute bottom-1 right-1 rounded px-1 text-[10px] font-semibold shadow-sm ${
                                  donkereSmaakKleur
                                    ? "bg-white/20 text-white"
                                    : "bg-white/70 text-slate-700"
                                }`}>
                                  {positie}
                                </span>
                              </>
                            ) : (
                              <span>{positie}</span>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Bewaar­kastindeling
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sleep smaken naar een schap en vul het aantal reservebakken
                  in. Dit is de praktische kastindeling voor de
                  Zomerfeestenweek.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => startPrint("bewaarkast")}
                  disabled={!planning.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  Print bewaarkasten
                </button>
                <button
                  type="button"
                  onClick={opslaanBewaarkast}
                  disabled={!planning.id || bewaarkastOpslaanBezig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {bewaarkastOpslaanBezig
                    ? "Opslaan..."
                    : "Bewaar­kasten opslaan"}
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-semibold text-slate-900">
                  In bewaarkasten: {bewaarkastTellingen.totaalBakken} bakken ·{" "}
                  {bewaarkastTellingen.gevuldeSchappen} schappen gevuld
                </div>
                <div className="text-slate-500">
                  Sleep een smaak naar een schap. Het aantal kun je daarna
                  aanpassen.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {smaken.map((smaak) => {
                  const code = smaak.smaakcode?.trim().toUpperCase();
                  if (!code) return null;
                  const inKast = bewaarkastTellingen.tellingen.get(code) || 0;

                  return (
                    <button
                      key={`bewaarkast-palette-${code}`}
                      type="button"
                      draggable
                      onDragStart={() => setDragSmaakcode(code)}
                      onDragEnd={() => setDragSmaakcode(null)}
                      className="inline-flex cursor-grab items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm active:cursor-grabbing"
                      title="Sleep naar de bewaarkast"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-slate-300"
                        style={{ backgroundColor: smaak.kleur || "#93c5fd" }}
                      />
                      <span>{smaak.smaaknaam}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {inKast} in kast
                      </span>
                    </button>
                  );
                })}

                {smaken.length === 0 && (
                  <div className="text-sm text-slate-500">
                    Voeg eerst smaken toe aan de smaakplanning.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {BEWAARKASTEN.map((kast) => (
                <div
                  key={kast.key}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-cyan-100 px-4 py-3 text-center font-bold uppercase tracking-wide text-slate-900">
                    {kast.label}
                  </div>
                  <div className="grid grid-cols-[1fr_54px_64px] border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                    <div className="px-3 py-2">Smaak</div>
                    <div className="px-3 py-2 text-center">Schap</div>
                    <div className="px-3 py-2 text-center">Aantal</div>
                  </div>

                  {Array.from({ length: BEWAARKAST_SCHAPPEN }, (_, index) => {
                    const schap = index + 1;
                    const key = `${kast.key}-${schap}`;
                    const positie = bewaarkastIndeling[key] || {
                      smaakcode: null,
                      aantal_bakken: 0,
                    };
                    const smaak = positie.smaakcode
                      ? smaakPerCode.get(positie.smaakcode)
                      : null;
                    const donkereSmaakKleur = isDonkereKleur(
                      smaak?.kleur || null,
                    );

                    return (
                      <div
                        key={key}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragSmaakcode)
                            zetBewaarkastSmaak(kast.key, schap, dragSmaakcode);
                        }}
                        className="grid grid-cols-[1fr_54px_64px] items-center border-b border-slate-100 last:border-b-0"
                      >
                        <div className="p-2">
                          <div
                            draggable={Boolean(smaak)}
                            onDragStart={() =>
                              positie.smaakcode &&
                              setDragSmaakcode(positie.smaakcode)
                            }
                            onDragEnd={() => setDragSmaakcode(null)}
                            className={`group relative flex min-h-[42px] items-center rounded-lg border px-3 py-2 text-sm font-bold ${
                              smaak
                                ? "cursor-grab border-slate-300 text-slate-900 shadow-sm active:cursor-grabbing"
                                : "border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-300 hover:bg-blue-50"
                            }`}
                            style={
                              smaak
                                ? {
                                    backgroundColor: smaak.kleur || "#bfdbfe",
                                    color: donkereSmaakKleur ? "#ffffff" : "#0f172a",
                                  }
                                : undefined
                            }
                          >
                            {smaak ? (
                              <>
                                <span className="truncate">{smaak.smaaknaam}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    zetBewaarkastSmaak(kast.key, schap, null);
                                  }}
                                  className={`absolute right-1 top-1 hidden rounded-full px-1 text-[10px] font-bold shadow-sm group-hover:block ${
                                    donkereSmaakKleur
                                      ? "bg-black/25 text-white"
                                      : "bg-white/80 text-slate-700"
                                  }`}
                                  title="Schap leegmaken"
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <span>Sleep smaak hier</span>
                            )}
                          </div>
                        </div>
                        <div className="px-2 text-center text-sm font-bold text-slate-700">
                          {schap}
                        </div>
                        <div className="px-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={positie.aantal_bakken || 0}
                            onChange={(e) =>
                              zetBewaarkastAantal(
                                kast.key,
                                schap,
                                Number(e.target.value || 0),
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ingrediëntencontrole
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Eerste controle: doorrekenbare smaken worden opgeschaald
                  vanuit het gekoppelde kostprijsrecept. Dit is nog géén
                  bestellijst.
                </p>
              </div>
              {ingredientenControle?.meta?.line_table && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Bron: {ingredientenControle.meta.line_table}
                </span>
              )}
            </div>

            {!planning.id && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Sla de planning eerst op om de ingrediëntencontrole te laden.
              </div>
            )}

            {planning.id && ingredientenControleError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Ingrediëntencontrole kon niet worden opgehaald. Controleer de
                serverlog voor de exacte databasefout.
              </div>
            )}

            {planning.id && ingredientenControle && (
              <div className="space-y-5">
                {(ingredientenControle.meta.waarschuwingen ?? []).map(
                  (waarschuwing, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                    >
                      {waarschuwing}
                    </div>
                  ),
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">
                      Doorrekenbare smaken
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      {ingredientenControle.smaken.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">
                      Ingrediëntregels
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      {ingredientenControle.smaken.reduce(
                        (sum, smaak) => sum + smaak.regels.length,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">
                      Bestelproducten na openklappen
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      {ingredientenControle.totalen.length}
                    </div>
                  </div>
                </div>

                {(ingredientenControle.tussenrecepten ?? []).length > 0 && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Tussenrecepten opengeklapt:{" "}
                    {(ingredientenControle.tussenrecepten ?? [])
                      .map(
                        (t) =>
                          `${t.naam} ${formatHoeveelheid(t.benodigde_hoeveelheid)} ${t.eenheid}`,
                      )
                      .join(" · ")}
                  </div>
                )}

                {ingredientenControle.smaken.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                      Controle per smaak
                    </div>
                    <div className="divide-y divide-slate-100">
                      {ingredientenControle.smaken.map((smaak) => (
                        <div key={smaak.smaakplanning_id} className="p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {smaak.smaakcode} · {smaak.smaaknaam}
                              </div>
                              <div className="text-sm text-slate-500">
                                {smaak.aantal_bakken} bakken via{" "}
                                {smaak.kostprijs_recept_naam} · opbrengst{" "}
                                {formatHoeveelheid(smaak.opbrengst_bakken)}{" "}
                                bak(ken) · factor{" "}
                                {formatHoeveelheid(smaak.factor)}
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {smaak.regels.length} regels
                            </span>
                          </div>

                          {smaak.waarschuwingen.length > 0 && (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              {smaak.waarschuwingen.join(" ")}
                            </div>
                          )}

                          {smaak.regels.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                              {smaak.regels.slice(0, 8).map((regel, index) => (
                                <div
                                  key={`${smaak.smaakplanning_id}-${index}`}
                                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-700">
                                    {regel.naam}
                                    {regel.type === "tussenrecept" && (
                                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                        tussenrecept
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 font-semibold text-slate-900">
                                    {formatHoeveelheid(
                                      regel.benodigde_hoeveelheid,
                                    )}{" "}
                                    {regel.eenheid}
                                  </span>
                                </div>
                              ))}
                              {smaak.regels.length > 8 && (
                                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                  + {smaak.regels.length - 8} extra regels
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(ingredientenControle.tussenrecepten ?? []).length > 0 && (
                  <div className="rounded-2xl border border-blue-100 overflow-hidden">
                    <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                      Tussenrecepten
                    </div>
                    <div className="divide-y divide-blue-100">
                      {(ingredientenControle.tussenrecepten ?? []).map(
                        (tussen) => (
                          <div
                            key={`${tussen.naam}-${tussen.eenheid}`}
                            className="p-4"
                          >
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {tussen.naam}
                                </div>
                                <div className="text-sm text-slate-500">
                                  Benodigd:{" "}
                                  {formatHoeveelheid(
                                    tussen.benodigde_hoeveelheid,
                                  )}{" "}
                                  {tussen.eenheid}
                                  {tussen.recept_naam
                                    ? ` · via ${tussen.recept_naam}`
                                    : ""}
                                  {tussen.factor !== null
                                    ? ` · factor ${formatHoeveelheid(tussen.factor)}`
                                    : ""}
                                </div>
                              </div>
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {tussen.regels.length} regels
                              </span>
                            </div>
                            {tussen.waarschuwingen.length > 0 && (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {tussen.waarschuwingen.join(" ")}
                              </div>
                            )}
                            {tussen.regels.length > 0 && (
                              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                {tussen.regels
                                  .slice(0, 8)
                                  .map((regel, index) => (
                                    <div
                                      key={`${tussen.naam}-${index}`}
                                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                                    >
                                      <span className="min-w-0 truncate text-slate-700">
                                        {regel.naam}
                                      </span>
                                      <span className="shrink-0 font-semibold text-slate-900">
                                        {formatHoeveelheid(
                                          regel.benodigde_hoeveelheid,
                                        )}{" "}
                                        {regel.eenheid}
                                      </span>
                                    </div>
                                  ))}
                                {tussen.regels.length > 8 && (
                                  <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500">
                                    + {tussen.regels.length - 8} extra regels
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {(ingredientenControle.besteladvies ?? []).length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 overflow-hidden print:hidden">
                    <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 print:bg-white print:border-slate-300">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold text-emerald-800 print:text-slate-900">
                            Besteladvies per leverancier
                          </div>
                          <div className="mt-1 text-xs text-emerald-700 print:text-slate-600">
                            Totaal te bestellen voor de volledige
                            Zomerfeestenplanning. Regels met “Nog invullen”
                            missen nog verpakkingsinformatie of een bruikbare
                            eenheid.
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startPrint("bestellijst")}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 print:hidden"
                          >
                            <Printer className="h-4 w-4" /> Print
                          </button>
                          <div className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm print:shadow-none print:border print:border-slate-200">
                            Totaal:{" "}
                            {formatEuroExact(
                              ingredientenControle.meta.totale_kosten ?? 0,
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-emerald-700 print:border print:border-slate-200 print:text-slate-700">
                          Leveranciers: {besteladviesPerLeverancier.length}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-emerald-700 print:border print:border-slate-200 print:text-slate-700">
                          Berekend:{" "}
                          {ingredientenControle.meta.besteladvies_berekend ?? 0}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-amber-700 print:border print:border-slate-200 print:text-slate-700">
                          Nog invullen:{" "}
                          {ingredientenControle.meta
                            .besteladvies_controle_nodig ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-emerald-100 print:divide-slate-200">
                      {besteladviesPerLeverancier.map((groep) => (
                        <div key={groep.leverancier} className="bg-white">
                          <div className="flex flex-col gap-1 border-b border-emerald-50 bg-emerald-50/60 px-4 py-3 md:flex-row md:items-center md:justify-between print:bg-slate-50 print:border-slate-200">
                            <div>
                              <div className="font-bold text-slate-900">
                                {groep.leverancier}
                              </div>
                              <div className="text-xs text-slate-500">
                                {groep.berekend} berekend ·{" "}
                                {groep.controleNodig} nog invullen
                              </div>
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {formatEuroExact(groep.totaalKosten)}
                            </div>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {groep.regels.map((regel) => (
                              <div
                                key={`${groep.leverancier}-${regel.product_id ?? regel.naam}-${regel.eenheid}`}
                                className="grid grid-cols-1 gap-3 px-4 py-3 text-sm lg:grid-cols-[minmax(0,1.4fr)_120px_120px_90px_100px_110px] lg:items-center"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-slate-900">
                                    {regel.product_naam || regel.naam}
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    {regel.bestelnummer
                                      ? `Bestelnr. ${regel.bestelnummer}`
                                      : "Geen bestelnummer"}
                                    {regel.melding ? ` · ${regel.melding}` : ""}
                                  </div>
                                </div>

                                <div className="text-slate-700 lg:text-right">
                                  <span className="lg:hidden text-slate-500">
                                    Nodig:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    {formatHoeveelheid(regel.totaal)}{" "}
                                    {regel.eenheid}
                                  </span>
                                </div>

                                <div className="text-slate-700 lg:text-right">
                                  <span className="lg:hidden text-slate-500">
                                    Verpakking:{" "}
                                  </span>
                                  {regel.verpakking_hoeveelheid_gebruikt
                                    ? `${formatHoeveelheid(regel.verpakking_hoeveelheid_gebruikt)} ${regel.verpakking_eenheid_gebruikt ?? ""}`
                                    : "verpakking onbekend"}
                                </div>

                                <div className="text-slate-900 lg:text-right">
                                  <span className="lg:hidden text-slate-500">
                                    Bestellen:{" "}
                                  </span>
                                  <span className="font-bold">
                                    {regel.bestellen ?? "–"}
                                  </span>
                                </div>

                                <div className="text-slate-700 lg:text-right">
                                  <span className="lg:hidden text-slate-500">
                                    Prijs:{" "}
                                  </span>
                                  {formatEuroExact(regel.huidige_prijs)}
                                </div>

                                <div className="flex items-center justify-between gap-2 lg:justify-end">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                      regel.status === "berekend"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    {regel.status === "berekend"
                                      ? formatEuroExact(regel.kosten)
                                      : "Nog invullen"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(ingredientenControle.besteladvies ?? []).length > 0 && (
                  <>
                  <div className="print-only-bestellijst hidden">
                    <h1>Besteladvies Zomerfeesten {planning.jaar}</h1>
                    <div className="print-meta">
                      <div>
                        {planning.naam} · {datumVoorInput(planning.start_datum)}{" "}
                        t/m {datumVoorInput(planning.eind_datum)}
                      </div>
                      <div>
                        Gegenereerd: {new Date().toLocaleDateString("nl-NL")}
                      </div>
                    </div>

                    <div className="print-total">
                      Totaal te bestellen:{" "}
                      {formatEuroExact(
                        ingredientenControle.meta.totale_kosten ?? 0,
                      )}
                      <span className="print-subtle">
                        {" "}
                        · Leveranciers: {besteladviesPerLeverancier.length} ·
                        Regels:{" "}
                        {ingredientenControle.meta.besteladvies_berekend ?? 0} ·
                        Nog invullen:{" "}
                        {ingredientenControle.meta
                          .besteladvies_controle_nodig ?? 0}
                      </span>
                    </div>

                    {besteladviesPerLeverancier.map((groep) => (
                      <section
                        key={`print-${groep.leverancier}`}
                        className="print-leverancier"
                      >
                        <div className="print-leverancier-header">
                          <h2>{groep.leverancier}</h2>
                          <div>
                            Subtotaal: {formatEuroExact(groep.totaalKosten)}
                            <span className="print-subtle">
                              {" "}
                              · {groep.berekend} regels
                              {groep.controleNodig > 0
                                ? ` · ${groep.controleNodig} nog invullen`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <table className="print-table">
                          <thead>
                            <tr>
                              <th style={{ width: "30%" }}>Product</th>
                              <th style={{ width: "13%" }}>Bestelnr.</th>
                              <th style={{ width: "12%" }} className="num">
                                Nodig
                              </th>
                              <th style={{ width: "12%" }} className="num">
                                Verpakking
                              </th>
                              <th style={{ width: "9%" }} className="num">
                                Bestellen
                              </th>
                              <th style={{ width: "11%" }} className="num">
                                Prijs
                              </th>
                              <th style={{ width: "13%" }} className="num">
                                Totaal
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groep.regels.map((regel) => (
                              <tr
                                key={`print-${groep.leverancier}-${regel.product_id ?? regel.naam}-${regel.eenheid}`}
                              >
                                <td>
                                  <div className="print-product">
                                    {regel.product_naam || regel.naam}
                                  </div>
                                  {regel.status !== "berekend" && (
                                    <div className="print-note">
                                      Verpakking/eenheid nog invullen
                                    </div>
                                  )}
                                </td>
                                <td>{regel.bestelnummer || "–"}</td>
                                <td className="num">
                                  {formatHoeveelheid(regel.totaal)}{" "}
                                  {regel.eenheid}
                                </td>
                                <td className="num">
                                  {regel.verpakking_hoeveelheid_gebruikt
                                    ? `${formatHoeveelheid(regel.verpakking_hoeveelheid_gebruikt)} ${regel.verpakking_eenheid_gebruikt ?? ""}`
                                    : "–"}
                                </td>
                                <td className="num">
                                  {regel.bestellen ?? "–"}
                                </td>
                                <td className="num">
                                  {formatEuroExact(regel.huidige_prijs)}
                                </td>
                                <td className="num">
                                  {regel.status === "berekend"
                                    ? formatEuroExact(regel.kosten)
                                    : "Nog invullen"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    ))}

                    <div className="print-grandtotal">
                      <span>Totaal Zomerfeesten</span>
                      <span>
                        {formatEuroExact(
                          ingredientenControle.meta.totale_kosten ?? 0,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="print-only-vitrine hidden">
                    <div className="print-sheet">
                      <h1>Vitrine-indeling Zomerfeesten {planning.jaar}</h1>
                      <div className="print-meta">
                        <span>{planning.naam || "Zomerfeesten"}</span>
                        <span>Periode: {planning.start_datum} t/m {planning.eind_datum}</span>
                      </div>
                      <div className="print-layout-grid">
                        {VITRINES.map((vitrine) => (
                          <section key={`print-vitrine-${vitrine.key}`} className="print-card">
                            <div className="print-card-header">
                              <h2>{vitrine.label}</h2>
                              <span className="print-pill">
                                {Array.from({ length: VITRINE_POSITIES_PER_VITRINE }).filter((_, index) => Boolean(vitrineIndeling[`${vitrine.key}-${index + 1}`])).length} / {VITRINE_POSITIES_PER_VITRINE}
                              </span>
                            </div>
                            <div className="print-vitrine-grid">
                              {Array.from({ length: VITRINE_POSITIES_PER_VITRINE }, (_, index) => {
                                const positie = index + 1;
                                const smaakcode = vitrineIndeling[`${vitrine.key}-${positie}`] || null;
                                const smaak = smaakcode ? smaakPerCode.get(smaakcode) : null;
                                const donker = isDonkereKleur(smaak?.kleur || null);
                                return (
                                  <div
                                    key={`print-vak-${vitrine.key}-${positie}`}
                                    className="print-vak"
                                    style={
                                      smaak
                                        ? { backgroundColor: smaak.kleur || "#bfdbfe", color: donker ? "#ffffff" : "#0f172a" }
                                        : { backgroundColor: "#f8fafc", color: "#94a3b8" }
                                    }
                                  >
                                    <span className="print-vak-code">{smaak ? smaak.smaakcode || smaak.smaaknaam : "—"}</span>
                                    <span
                                      className="print-vak-pos"
                                      style={
                                        smaak
                                          ? { backgroundColor: donker ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.72)", color: donker ? "#ffffff" : "#334155" }
                                          : { backgroundColor: "#e2e8f0", color: "#64748b" }
                                      }
                                    >
                                      {positie}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="print-only-bewaarkast hidden">
                    <div className="print-sheet">
                      <h1>Bewaarkastindeling Zomerfeesten {planning.jaar}</h1>
                      <div className="print-meta">
                        <span>{planning.naam || "Zomerfeesten"}</span>
                        <span>Periode: {planning.start_datum} t/m {planning.eind_datum}</span>
                      </div>
                      <div className="print-layout-grid">
                        {BEWAARKASTEN.map((kast) => (
                          <section key={`print-bewaarkast-${kast.key}`} className="print-card">
                            <div className="print-card-header">
                              <h2>{kast.label}</h2>
                              <span className="print-pill">
                                {Array.from({ length: BEWAARKAST_SCHAPPEN }).reduce(
                                  (sum, _, index) =>
                                    sum + Number(bewaarkastIndeling[`${kast.key}-${index + 1}`]?.aantal_bakken || 0),
                                  0,
                                )} bakken
                              </span>
                            </div>
                            <table className="print-bewaarkast-table">
                              <thead>
                                <tr>
                                  <th>Smaak</th>
                                  <th>Schap</th>
                                  <th>Aantal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: BEWAARKAST_SCHAPPEN }, (_, index) => {
                                  const schap = index + 1;
                                  const entry = bewaarkastIndeling[`${kast.key}-${schap}`];
                                  const smaak = entry?.smaakcode ? smaakPerCode.get(entry.smaakcode) : null;
                                  const donker = isDonkereKleur(smaak?.kleur || null);
                                  return (
                                    <tr key={`print-bewaarkast-row-${kast.key}-${schap}`}>
                                      <td
                                        className="print-bewaarkast-smaak"
                                        style={
                                          smaak
                                            ? { backgroundColor: smaak.kleur || "#f8fafc", color: donker ? "#ffffff" : "#0f172a" }
                                            : undefined
                                        }
                                      >
                                        {smaak ? smaak.smaaknaam : "—"}
                                      </td>
                                      <td>{schap}</td>
                                      <td>{Number(entry?.aantal_bakken || 0)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                )}

                {ingredientenControle.totalen.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                      Gecombineerde bestelproductencontrole
                    </div>
                    <div className="divide-y divide-slate-100">
                      {ingredientenControle.totalen.map((totaal) => (
                        <div
                          key={`${totaal.naam}-${totaal.eenheid}`}
                          className="grid grid-cols-[minmax(0,1fr)_140px_90px] gap-3 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0 truncate font-medium text-slate-800">
                            {totaal.naam}
                          </div>
                          <div className="text-right font-semibold text-slate-900">
                            {formatHoeveelheid(totaal.totaal)} {totaal.eenheid}
                          </div>
                          <div className="text-right text-slate-500">
                            {totaal.bronregels} regels
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {planning.id && (
            <div className="flex justify-end lg:col-span-2">
              <button
                type="button"
                onClick={verwijderPlanning}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Planning verwijderen
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
