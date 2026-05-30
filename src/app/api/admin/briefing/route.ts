// src/app/api/admin/briefing/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dbRapportage } from "@/lib/dbRapportage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BriefingStatus = "ok" | "leeg" | "fout" | "niet_gekoppeld";

type BriefingOnderdeel<T> = {
  status: BriefingStatus;
  data: T;
  melding?: string;
};

type WeerUur = {
  tijd: string;
  uur: string;
  temperatuur: number | null;
  neerslagKans: number | null;
  neerslagMm: number | null;
  windKmh: number | null;
};

function telDagenOp(datum: string, dagen: number) {
  const date = new Date(`${datum}T12:00:00`);
  date.setDate(date.getDate() + dagen);
  return date.toISOString().slice(0, 10);
}

function vandaagAmsterdamIso() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function formatDatumLang(datum: string) {
  const date = new Date(`${datum}T12:00:00`);
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function veiligGetal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function haalWeerOp(datum: string): Promise<BriefingOnderdeel<{
  locatie: string;
  periode: string;
  uren: WeerUur[];
  samenvatting: string;
  drukteverwachting: string;
}>> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", "51.8425");
    url.searchParams.set("longitude", "5.8528");
    url.searchParams.set("timezone", "Europe/Amsterdam");
    url.searchParams.set("start_date", datum);
    url.searchParams.set("end_date", datum);
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "precipitation_probability",
        "precipitation",
        "wind_speed_10m",
      ].join(",")
    );

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "fout",
        data: {
          locatie: "Nijmegen",
          periode: "12:00–22:00",
          uren: [],
          samenvatting: "Weer kon niet worden opgehaald.",
          drukteverwachting: "Geen drukteverwachting beschikbaar.",
        },
        melding: `Open-Meteo gaf status ${res.status}`,
      };
    }

    const json = await res.json();

    const tijden: string[] = json?.hourly?.time || [];
    const temperaturen: unknown[] = json?.hourly?.temperature_2m || [];
    const neerslagKansen: unknown[] = json?.hourly?.precipitation_probability || [];
    const neerslagMm: unknown[] = json?.hourly?.precipitation || [];
    const wind: unknown[] = json?.hourly?.wind_speed_10m || [];

    const uren: WeerUur[] = tijden
      .map((tijd, index) => {
        const uur = tijd.slice(11, 16);

        return {
          tijd,
          uur,
          temperatuur: veiligGetal(temperaturen[index]),
          neerslagKans: veiligGetal(neerslagKansen[index]),
          neerslagMm: veiligGetal(neerslagMm[index]),
          windKmh: veiligGetal(wind[index]),
        };
      })
      .filter((item) => item.uur >= "12:00" && item.uur <= "22:00");

    if (uren.length === 0) {
      return {
        status: "leeg",
        data: {
          locatie: "Nijmegen",
          periode: "12:00–22:00",
          uren: [],
          samenvatting: "Geen weerdata gevonden voor 12:00–22:00.",
          drukteverwachting: "Geen drukteverwachting beschikbaar.",
        },
      };
    }

    const temperaturenBekend = uren
      .map((uur) => uur.temperatuur)
      .filter((value): value is number => value !== null);

    const regenKansenBekend = uren
      .map((uur) => uur.neerslagKans)
      .filter((value): value is number => value !== null);

    const minTemp =
      temperaturenBekend.length > 0 ? Math.round(Math.min(...temperaturenBekend)) : null;
    const maxTemp =
      temperaturenBekend.length > 0 ? Math.round(Math.max(...temperaturenBekend)) : null;
    const maxRegenKans =
      regenKansenBekend.length > 0 ? Math.max(...regenKansenBekend) : null;

    const natteUren = uren.filter(
      (uur) =>
        (uur.neerslagKans !== null && uur.neerslagKans >= 40) ||
        (uur.neerslagMm !== null && uur.neerslagMm >= 0.5)
    );

    const eersteNatUur = natteUren[0]?.uur || null;

    let samenvatting = "Weerdata beschikbaar.";
    let drukteverwachting = "Normale drukteverwachting.";

    if (minTemp !== null && maxTemp !== null) {
      if (maxRegenKans !== null && maxRegenKans >= 50 && eersteNatUur) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Verhoogde kans op regen vanaf ongeveer ${eersteNatUur}.`;
        drukteverwachting =
          "Middag mogelijk goed, maar avond kan rustiger worden door regenrisico.";
      } else if (maxTemp >= 22 && (maxRegenKans === null || maxRegenKans < 35)) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Grotendeels geschikt terrasweer.`;
        drukteverwachting =
          "Kans op extra drukte in de middag en vroege avond, vooral tussen 14:00 en 17:00.";
      } else if (maxTemp >= 18 && (maxRegenKans === null || maxRegenKans < 45)) {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Redelijk terrasweer.`;
        drukteverwachting =
          "Redelijke drukte mogelijk, afhankelijk van zon en wind.";
      } else {
        samenvatting = `${minTemp}–${maxTemp}°C tussen 12:00 en 22:00. Beperkt terrasweer.`;
        drukteverwachting =
          "Geen duidelijke extra drukte verwacht op basis van het weer.";
      }
    }

    return {
      status: "ok",
      data: {
        locatie: "Nijmegen",
        periode: "12:00–22:00",
        uren,
        samenvatting,
        drukteverwachting,
      },
    };
  } catch (error) {
    return {
      status: "fout",
      data: {
        locatie: "Nijmegen",
        periode: "12:00–22:00",
        uren: [],
        samenvatting: "Weer kon niet worden opgehaald.",
        drukteverwachting: "Geen drukteverwachting beschikbaar.",
      },
      melding: String(error),
    };
  }
}

async function haalSollicitantenOp(
  datum: string,
  origin: string
): Promise<BriefingOnderdeel<any[]>> {
  try {
    /**
     * Eerste koppeling via bestaande Calendly-vandaag endpoint.
     * Dit voorkomt dat we afhankelijk zijn van kolommen in de sollicitaties-tabel
     * die mogelijk niet bestaan.
     */
    const vandaag = vandaagAmsterdamIso();

    if (datum !== vandaag) {
      return {
        status: "niet_gekoppeld",
        data: [],
        melding:
          "Sollicitatieafspraken zijn voorlopig alleen gekoppeld voor vandaag via Calendly.",
      };
    }

    const url = new URL("/api/calendly/vandaag", origin);

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "fout",
        data: [],
        melding: `Calendly-vandaag kon niet worden opgehaald. Status: ${res.status}`,
      };
    }

    const json = await res.json();

    const afspraken =
      Array.isArray(json)
        ? json
        : Array.isArray(json?.afspraken)
          ? json.afspraken
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.events)
              ? json.events
              : Array.isArray(json?.data)
                ? json.data
                : [];

    return {
      status: afspraken.length > 0 ? "ok" : "leeg",
      data: afspraken,
    };
  } catch (error) {
    return {
      status: "fout",
      data: [],
      melding: `Sollicitatieafspraken konden niet worden opgehaald: ${String(error)}`,
    };
  }
}

async function haalHaccpOp(datum: string): Promise<BriefingOnderdeel<{
  samenvatting: {
    totaalTaken: number;
    afgerondTaken: number;
    openTaken: number;
    overduePeriodiek: number;
    overgeslagenVandaag: number;
    routinesMetOpenTaken: number;
  };
  openTaken: any[];
  overdueTaken: any[];
  overgeslagenVandaag: any[];
  routines: any[];
}>> {
  try {
    const routineSlugs = [
      "keuken-opstart",
      "keuken-afsluit",
      "keuken-eindschoonmaak",
      "winkel-opstart",
      "winkel-afsluit",
    ];

    const result = await db.query(
      `
      WITH basis AS (
        SELECT
          r.id AS routine_id,
          r.naam AS routine_naam,
          r.slug AS routine_slug,
          r.locatie,
          r.type,

          t.id AS taak_id,
          t.naam AS taak_naam,
          t.frequentie,
          COALESCE(t.weekdagen, '[]'::jsonb) AS weekdagen,
          COALESCE(t.sortering, 9999) AS sortering,

          a.afgetekend_door_naam,
          a.afgetekend_op,
          a.status,
          a.bron,
          a.overgeslagen_reden,

          laatst.datum AS laatst_gedaan_datum,

          CASE t.frequentie
            WHEN 'M' THEN (laatst.datum + INTERVAL '1 month')::date
            WHEN 'Q' THEN (laatst.datum + INTERVAL '3 months')::date
            WHEN 'H' THEN (laatst.datum + INTERVAL '6 months')::date
            WHEN 'Y' THEN (laatst.datum + INTERVAL '1 year')::date
            ELSE NULL
          END AS vervaldatum

        FROM routines r
        JOIN routine_taken t
          ON t.routine_id = r.id
         AND COALESCE(t.actief, true) = true

        LEFT JOIN routine_aftekeningen a
          ON a.routine_taak_id = t.id
         AND a.datum = $1::date

        LEFT JOIN LATERAL (
          SELECT la.datum
          FROM routine_aftekeningen la
          WHERE la.routine_taak_id = t.id
            AND la.status = 'gedaan'
            AND la.afgetekend_op IS NOT NULL
            AND la.datum <= $1::date
          ORDER BY la.datum DESC, la.afgetekend_op DESC
          LIMIT 1
        ) laatst ON true

        WHERE COALESCE(r.actief, true) = true
          AND r.slug = ANY($2::text[])
      ),
      zichtbaar AS (
        SELECT
          *,
          CASE
            WHEN frequentie IN ('M', 'Q', 'H', 'Y') THEN
              afgetekend_op IS NOT NULL
              OR laatst_gedaan_datum IS NULL
              OR vervaldatum <= $1::date

            WHEN jsonb_array_length(weekdagen) > 0
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(weekdagen) AS wd(dag)
                WHERE wd.dag = CASE EXTRACT(ISODOW FROM $1::date)
                  WHEN 1 THEN 'ma'
                  WHEN 2 THEN 'di'
                  WHEN 3 THEN 'wo'
                  WHEN 4 THEN 'do'
                  WHEN 5 THEN 'vr'
                  WHEN 6 THEN 'za'
                  WHEN 7 THEN 'zo'
                END
              )
              THEN false

            WHEN frequentie = '2D' THEN
              MOD(($1::date - DATE '2026-01-05')::int, 2) = 0

            ELSE true
          END AS zichtbaar,

          CASE
            WHEN frequentie NOT IN ('M', 'Q', 'H', 'Y') THEN NULL
            WHEN laatst_gedaan_datum IS NULL THEN NULL
            WHEN vervaldatum < $1::date THEN ($1::date - vervaldatum)::int
            ELSE 0
          END AS dagen_te_laat

        FROM basis
      )
      SELECT *
      FROM zichtbaar
      WHERE zichtbaar = true
      ORDER BY
        locatie ASC,
        type ASC,
        routine_naam ASC,
        sortering ASC,
        taak_naam ASC
      `,
      [datum, routineSlugs]
    );

    const taken = result.rows.map((row) => {
      const afgetekend = Boolean(row.afgetekend_op);
      const isPeriodiek = ["M", "Q", "H", "Y"].includes(row.frequentie);

      return {
        routineId: row.routine_id,
        routineNaam: row.routine_naam,
        routineSlug: row.routine_slug,
        locatie: row.locatie,
        type: row.type,

        taakId: row.taak_id,
        taakNaam: row.taak_naam,
        frequentie: row.frequentie,
        sortering: row.sortering,

        afgetekend,
        afgetekendDoorNaam: row.afgetekend_door_naam,
        afgetekendOp: row.afgetekend_op,
        status: row.status,
        bron: row.bron,
        overgeslagenReden: row.overgeslagen_reden,

        isPeriodiek,
        laatstGedaanDatum: row.laatst_gedaan_datum,
        vervaldatum: row.vervaldatum,
        dagenTeLaat:
          row.dagen_te_laat === null || row.dagen_te_laat === undefined
            ? null
            : Number(row.dagen_te_laat),
      };
    });

    const openTaken = taken.filter((taak) => !taak.afgetekend);

    const overdueTaken = taken.filter((taak) => {
      if (!taak.isPeriodiek) return false;
      if (taak.afgetekend) return false;
      if (!taak.laatstGedaanDatum) return true;
      if (!taak.vervaldatum) return false;

      return String(taak.vervaldatum).slice(0, 10) <= datum;
    });

    const overgeslagenVandaag = taken.filter(
      (taak) => taak.status === "overgeslagen"
    );

    const routinesMap = new Map<
      string,
      {
        routineId: number;
        routineNaam: string;
        routineSlug: string;
        locatie: string | null;
        type: string | null;
        totaalTaken: number;
        afgerondTaken: number;
        openTaken: number;
        overdueTaken: number;
      }
    >();

    for (const taak of taken) {
      const key = taak.routineSlug;

      if (!routinesMap.has(key)) {
        routinesMap.set(key, {
          routineId: taak.routineId,
          routineNaam: taak.routineNaam,
          routineSlug: taak.routineSlug,
          locatie: taak.locatie,
          type: taak.type,
          totaalTaken: 0,
          afgerondTaken: 0,
          openTaken: 0,
          overdueTaken: 0,
        });
      }

      const routine = routinesMap.get(key)!;

      routine.totaalTaken += 1;

      if (taak.afgetekend) {
        routine.afgerondTaken += 1;
      } else {
        routine.openTaken += 1;
      }

      if (overdueTaken.some((overdue) => overdue.taakId === taak.taakId)) {
        routine.overdueTaken += 1;
      }
    }

    const routines = Array.from(routinesMap.values());

    return {
      status: "ok",
      data: {
        samenvatting: {
          totaalTaken: taken.length,
          afgerondTaken: taken.filter((taak) => taak.afgetekend).length,
          openTaken: openTaken.length,
          overduePeriodiek: overdueTaken.length,
          overgeslagenVandaag: overgeslagenVandaag.length,
          routinesMetOpenTaken: routines.filter((routine) => routine.openTaken > 0)
            .length,
        },
        openTaken,
        overdueTaken,
        overgeslagenVandaag,
        routines,
      },
      melding: "HACCP-blok gekoppeld op basis van bestaande routine- en aftekenlogica.",
    };
  } catch (error) {
    return {
      status: "fout",
      data: {
        samenvatting: {
          totaalTaken: 0,
          afgerondTaken: 0,
          openTaken: 0,
          overduePeriodiek: 0,
          overgeslagenVandaag: 0,
          routinesMetOpenTaken: 0,
        },
        openTaken: [],
        overdueTaken: [],
        overgeslagenVandaag: [],
        routines: [],
      },
      melding: `HACCP kon niet worden opgehaald: ${String(error)}`,
    };
  }
}

async function haalPersoneelOp(
  datum: string,
  origin: string
): Promise<BriefingOnderdeel<{
  ingepland: any[];
  openShifts: any[];
  klokurenGoedTeKeuren: {
    aantal: number | null;
    oudsteDatum: string | null;
    regels: any[];
  };
  jarigVandaag: any[];
}>> {
  const meldingen: string[] = [];

  let ingepland: any[] = [];
  let openShifts: any[] = [];
  let klokurenRegels: any[] = [];
  let jarigVandaag: any[] = [];

try {
        const roosterUrl = new URL("/api/shiftbase/rooster", origin);
        roosterUrl.searchParams.set("datum", datum);

        const res = await fetch(roosterUrl.toString(), {
          cache: "no-store",
        });

        if (res.ok) {
          const json = await res.json();

          ingepland = Array.isArray(json)
            ? json
                .map((item: any) => ({
                  id: item?.Roster?.id ?? item?.id ?? null,
                  datum,
                  starttijd: item?.Roster?.starttime ?? null,
                  eindtijd: item?.Roster?.endtime ?? null,
                  shiftCode: item?.Roster?.name ?? null,
                  shiftNaam:
                    item?.Shift?.long_name ||
                    item?.Shift?.name ||
                    item?.Roster?.name ||
                    "Dienst",
                  shiftKleur: item?.Shift?.color || null,
                  medewerkerId: item?.Roster?.user_id ?? item?.User?.id ?? null,
                  medewerkerNaam:
                    item?.User?.name ||
                    item?.User?.full_name ||
                    item?.User?.fullName ||
                    "Onbekend",
                }))
                .sort((a: any, b: any) => {
                  const tijd = String(a.starttijd || "").localeCompare(String(b.starttijd || ""));
                  if (tijd !== 0) return tijd;

                  return String(a.medewerkerNaam || "").localeCompare(
                    String(b.medewerkerNaam || "")
                  );
                })
            : [];
        } else {
          meldingen.push(`Dagrooster kon niet worden opgehaald. Status: ${res.status}`);
        }
      } catch (error) {
        meldingen.push(`Dagrooster kon niet worden opgehaald: ${String(error)}`);
      }



  try {
    const openShiftsUrl = new URL("/api/shiftbase/open-diensten", origin);
    openShiftsUrl.searchParams.set("min_date", datum);
    openShiftsUrl.searchParams.set("max_date", datum);

    const res = await fetch(openShiftsUrl.toString(), {
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();

      openShifts = Array.isArray(json?.data)
        ? json.data
            .map((item: any) => ({
              id: item?.OpenShift?.id ?? null,
              datum: item?.OpenShift?.date ?? null,
              starttijd: item?.OpenShift?.starttime ?? null,
              eindtijd: item?.OpenShift?.endtime ?? null,
              omschrijving:
                item?.OpenShift?.description ||
                item?.Shift?.long_name ||
                "Open dienst",
              shift: item?.Shift ?? null,
            }))
            .filter((item: any) => item.datum === datum)
        : [];
    } else {
      meldingen.push(`Open shifts konden niet worden opgehaald. Status: ${res.status}`);
    }
  } catch (error) {
    meldingen.push(`Open shifts konden niet worden opgehaald: ${String(error)}`);
  }

  try {
    const minDate = telDagenOp(datum, -30);

    const [timesheetsRes, medewerkersRes] = await Promise.all([
      fetch(`${origin}/api/shiftbase/timesheets?min_date=${minDate}`, {
        cache: "no-store",
      }),
      fetch(`${origin}/api/shiftbase/medewerkers`, {
        cache: "no-store",
      }),
    ]);

    const timesheetsJson = timesheetsRes.ok ? await timesheetsRes.json() : { data: [] };
    const medewerkersJson = medewerkersRes.ok ? await medewerkersRes.json() : { data: [] };

    const medewerkersMap =
      Array.isArray(medewerkersJson?.data)
        ? Object.fromEntries(
            medewerkersJson.data
              .filter((m: any) => m.fullName !== "Anonymous User")
              .map((m: any) => [m.id, m.fullName])
          )
        : {};

    klokurenRegels = Array.isArray(timesheetsJson?.data)
      ? timesheetsJson.data
          .map((item: any) => item?.Timesheet)
          .filter(Boolean)
          .filter((regel: any) => regel.status !== "Approved" && regel.status !== "Declined")
          .map((regel: any) => ({
            id: regel.id,
            datum: regel.date,
            starttijd: regel.starttime,
            eindtijd: regel.endtime,
            medewerkerId: regel.user_id,
            medewerkerNaam: medewerkersMap[regel.user_id] || regel.user_id,
            status: regel.status,
            totaal: regel.total,
          }))
          .sort((a: any, b: any) => String(a.datum).localeCompare(String(b.datum)))
      : [];

    if (!timesheetsRes.ok) {
      meldingen.push(`Klokuren konden niet worden opgehaald. Status: ${timesheetsRes.status}`);
    }

    if (!medewerkersRes.ok) {
      meldingen.push(
        `Medewerkernamen bij klokuren konden niet worden opgehaald. Status: ${medewerkersRes.status}`
      );
    }
  } catch (error) {
    meldingen.push(`Klokuren konden niet worden opgehaald: ${String(error)}`);
  }

  try {
    const kolommen = await db.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'medewerkers'
        AND column_name = 'geboortedatum'
      `
    );

    if (kolommen.rows.length > 0) {
      const jarigen = await db.query(
        `
        SELECT
          naam,
          email,
          geboortedatum
        FROM medewerkers
        WHERE geboortedatum IS NOT NULL
          AND EXTRACT(MONTH FROM geboortedatum::date) = EXTRACT(MONTH FROM $1::date)
          AND EXTRACT(DAY FROM geboortedatum::date) = EXTRACT(DAY FROM $1::date)
        ORDER BY naam
        `,
        [datum]
      );

      jarigVandaag = jarigen.rows;
    } else {
      meldingen.push("Verjaardagen niet gekoppeld: kolom geboortedatum bestaat niet in medewerkers.");
    }
  } catch (error) {
    meldingen.push(`Verjaardagen konden niet worden opgehaald: ${String(error)}`);
  }

  const oudsteDatum =
        klokurenRegels.length > 0
          ? klokurenRegels
              .map((regel: any) => regel.datum)
              .filter(Boolean)
              .sort()[0] || null
          : null;

      return {
        status: meldingen.length > 0 ? "fout" : "ok",
        data: {
          ingepland,
          openShifts,
          klokurenGoedTeKeuren: {
            aantal: klokurenRegels.length,
            oudsteDatum,
            regels: klokurenRegels.slice(0, 20),
          },
          jarigVandaag,
        },
        melding:
          meldingen.length > 0
            ? meldingen.join(" ")
            : "Personeelblok gekoppeld: dagrooster, open shifts, klokuren en verjaardagen.",
      };
    }

async function haalBijzonderhedenOp(datum: string): Promise<BriefingOnderdeel<{
  feestdag: string | null;
  evenementen: any[];
  opmerkingen: any[];
}>> {
  try {
    const feestdagResult = await dbRapportage.query(
      `
      SELECT
        naam,
        TO_CHAR(datum, 'YYYY-MM-DD') AS datum
      FROM rapportage.feestdagen
      WHERE datum = $1::date
      LIMIT 1
      `,
      [datum]
    );

    const feestdag = feestdagResult.rows[0]?.naam || null;

    return {
      status: "ok",
      data: {
        feestdag,
        evenementen: [],
        opmerkingen: [],
      },
      melding: feestdag
        ? `Bijzonderheden gekoppeld: ${feestdag}.`
        : "Bijzonderheden gekoppeld: geen bijzonderheid gevonden in eigen tabel.",
    };
  } catch (error) {
    return {
      status: "fout",
      data: {
        feestdag: null,
        evenementen: [],
        opmerkingen: [],
      },
      melding: `Bijzonderheden konden niet worden opgehaald uit rapportage.feestdagen: ${String(error)}`,
    };
  }
}

export async function GET(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum") || vandaagAmsterdamIso();

  const [
    weer,
    personeel,
    sollicitanten,
    haccp,
    bijzonderheden,
  ] = await Promise.all([
    haalWeerOp(datum),
    haalPersoneelOp(datum, req.nextUrl.origin),
    haalSollicitantenOp(datum, req.nextUrl.origin),
    haalHaccpOp(datum),
    haalBijzonderhedenOp(datum),
  ]);

  return NextResponse.json({
    success: true,
    datum,
    datumLabel: formatDatumLang(datum),
    titel: "Dagbriefing Vincenzo",
    gegenereerdOp: new Date().toISOString(),
    onderdelen: {
      weer,
      personeel,
      sollicitanten,
      haccp,
      bijzonderheden,
    },
  });
}