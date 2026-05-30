// src/lib/briefing/renderBriefingEmail.ts

type BriefingOnderdeel<T> = {
  status: "ok" | "leeg" | "fout" | "niet_gekoppeld";
  data: T;
  melding?: string;
};

type BriefingData = {
  success: boolean;
  datum: string;
  datumLabel: string;
  titel: string;
  gegenereerdOp: string;
  onderdelen: {
    weer: BriefingOnderdeel<any>;
    personeel: BriefingOnderdeel<any>;
    sollicitanten: BriefingOnderdeel<any[]>;
    haccp: BriefingOnderdeel<any>;
    bijzonderheden: BriefingOnderdeel<any>;
  };
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTijd(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatDatum(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normaliseerShiftNaam(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function bepaalShiftGroep(dienst: any) {
  const naam = normaliseerShiftNaam(dienst?.shiftNaam || dienst?.shiftCode);

  if (/shift\s*1/i.test(naam) || /\bS1\b/i.test(naam)) return "Shift 1";
  if (/shift\s*2/i.test(naam) || /\bS2\b/i.test(naam)) return "Shift 2";

  return "Overig";
}

function bepaalRolLabel(dienst: any) {
  const naam = normaliseerShiftNaam(dienst?.shiftNaam || dienst?.shiftCode);

  if (/keuken voorbereiden/i.test(naam)) return "Keuken voorbereiden";
  if (/voorbereiden/i.test(naam)) return "Voorbereiden";
  if (/keuken/i.test(naam)) return "Keuken";
  if (/standby/i.test(naam)) return "StandBy";

  return "Winkel";
}

function hexNaarRgb(hex: string) {
  const clean = hex.replace("#", "").trim();

  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rolBadge(label: string, kleur: string | null | undefined) {
  const fallback = {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
  };

  const rgb = kleur ? hexNaarRgb(kleur) : null;

  const colors = rgb
    ? {
        bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        text: kleur,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
      }
    : fallback;

  return `
    <span style="display: inline-block; margin-left: 7px; padding: 2px 8px; border-radius: 999px; background: ${colors.bg}; color: ${colors.text}; border: 1px solid ${colors.border}; font-size: 11px; font-weight: 700; white-space: nowrap;">
      ${escapeHtml(label)}
    </span>
  `;
}

function sorteerDiensten(a: any, b: any) {
  const groepVolgorde: Record<string, number> = {
    "Shift 1": 1,
    "Shift 2": 2,
    Overig: 3,
  };

  const groepA = bepaalShiftGroep(a);
  const groepB = bepaalShiftGroep(b);

  const groepSort =
    (groepVolgorde[groepA] || 99) - (groepVolgorde[groepB] || 99);

  if (groepSort !== 0) return groepSort;

  const tijdSort = String(a.starttijd || "").localeCompare(
    String(b.starttijd || "")
  );

  if (tijdSort !== 0) return tijdSort;

  const rolSort = bepaalRolLabel(a).localeCompare(bepaalRolLabel(b));

  if (rolSort !== 0) return rolSort;

  return String(a.medewerkerNaam || "").localeCompare(
    String(b.medewerkerNaam || "")
  );
}

function groepeerDiensten(diensten: any[]) {
  const groepen = new Map<string, any[]>();

  for (const dienst of [...diensten].sort(sorteerDiensten)) {
    const groep = bepaalShiftGroep(dienst);

    if (!groepen.has(groep)) {
      groepen.set(groep, []);
    }

    groepen.get(groep)!.push(dienst);
  }

  const volgorde = ["Shift 1", "Shift 2", "Overig"];

  return volgorde
    .filter((groep) => groepen.has(groep))
    .map((groep) => ({
      naam: groep,
      diensten: groepen.get(groep) || [],
    }));
}





function section(title: string, inhoud: string) {
  return `
    <tr>
      <td style="padding: 0 24px 18px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <tr>
            <td style="padding: 18px 18px 8px 18px;">
              <h2 style="margin: 0; font-size: 18px; line-height: 1.3; color: #0f172a;">
                ${escapeHtml(title)}
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 18px 18px 18px; color: #334155; font-size: 15px; line-height: 1.55;">
              ${inhoud}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function badge(label: string, kleur: "groen" | "oranje" | "rood" | "blauw" | "grijs" = "grijs") {
  const kleuren = {
    groen: {
      bg: "#dcfce7",
      text: "#166534",
      border: "#bbf7d0",
    },
    oranje: {
      bg: "#ffedd5",
      text: "#9a3412",
      border: "#fed7aa",
    },
    rood: {
      bg: "#fee2e2",
      text: "#991b1b",
      border: "#fecaca",
    },
    blauw: {
      bg: "#dbeafe",
      text: "#1e40af",
      border: "#bfdbfe",
    },
    grijs: {
      bg: "#f1f5f9",
      text: "#475569",
      border: "#e2e8f0",
    },
  }[kleur];

  return `
    <span style="display: inline-block; margin: 2px 6px 2px 0; padding: 4px 9px; border-radius: 999px; background: ${kleuren.bg}; color: ${kleuren.text}; border: 1px solid ${kleuren.border}; font-size: 12px; font-weight: 700;">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderWeer(briefing: BriefingData) {
  const weer = briefing.onderdelen.weer;

  if (weer.status !== "ok") {
    return section(
      "Weer & drukteverwachting",
      `<p style="margin: 0;">${escapeHtml(weer.melding || "Weer niet beschikbaar.")}</p>`
    );
  }

  const data = weer.data;
  const uren = Array.isArray(data?.uren) ? data.uren : [];

  const compacteUren = uren
    .filter((uur: any) => ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00"].includes(uur.uur))
    .map((uur: any) => {
      const temperatuur =
        uur.temperatuur === null || uur.temperatuur === undefined
          ? "-"
          : `${Math.round(Number(uur.temperatuur))}°C`;

      const regen =
        uur.neerslagKans === null || uur.neerslagKans === undefined
          ? "-"
          : `${Math.round(Number(uur.neerslagKans))}%`;

      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(uur.uur)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(temperatuur)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(regen)}</td>
        </tr>
      `;
    })
    .join("");

  return section(
    "Weer & drukteverwachting",
    `
      <p style="margin: 0 0 8px 0;"><strong>${escapeHtml(data?.samenvatting || "")}</strong></p>
      <p style="margin: 0 0 14px 0;">${escapeHtml(data?.drukteverwachting || "")}</p>

      ${
        compacteUren
          ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 14px;">
              <tr>
                <th align="left" style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Tijd</th>
                <th align="left" style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Temp.</th>
                <th align="left" style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Regen</th>
              </tr>
              ${compacteUren}
            </table>
          `
          : ""
      }
    `
  );
}

function renderPersoneel(briefing: BriefingData) {
  const personeel = briefing.onderdelen.personeel;

  if (personeel.status !== "ok") {
    return section(
      "Personeel",
      `<p style="margin: 0;">${escapeHtml(personeel.melding || "Personeelgegevens niet beschikbaar.")}</p>`
    );
  }

  const data = personeel.data || {};
  const ingepland = Array.isArray(data.ingepland) ? data.ingepland : [];
  const openShifts = Array.isArray(data.openShifts) ? data.openShifts : [];
  const klokuren = data.klokurenGoedTeKeuren || {};
  const jarigen = Array.isArray(data.jarigVandaag) ? data.jarigVandaag : [];

  const ingeplandHtml =
          ingepland.length > 0
            ? `
              <p style="margin: 12px 0 10px 0;"><strong>Dagrooster vandaag</strong></p>

              ${groepeerDiensten(ingepland)
                .map(
                  (groep) => `
                    <p style="margin: 14px 0 6px 0; color: #0f172a;">
                      <strong>${escapeHtml(groep.naam)}</strong>
                    </p>

                    <ul style="margin: 0 0 12px 20px; padding: 0;">
                      ${groep.diensten
                        .map((dienst: any) => {
                          const rol = bepaalRolLabel(dienst);
                          const kleur = dienst.shiftKleur || null;

                          return `
                            <li style="margin-bottom: 4px;">
                              ${escapeHtml(formatTijd(dienst.starttijd))}–${escapeHtml(formatTijd(dienst.eindtijd))}
                              ${escapeHtml(dienst.medewerkerNaam || "Onbekend")}
                              ${rolBadge(rol, kleur)}
                            </li>
                          `;
                        })
                        .join("")}
                    </ul>
                  `
                )
                .join("")}
            `
            : `<p style="margin: 12px 0;">${badge("Geen dagrooster gevonden", "oranje")}</p>`;


  const openShiftHtml =
    openShifts.length > 0
      ? `
        <p style="margin: 16px 0 6px 0;">
          <strong>Open shifts</strong>
          ${badge(`${openShifts.length} open`, "oranje")}
        </p>
        <ul style="margin: 0 0 12px 20px; padding: 0;">
          ${openShifts
            .map(
              (shift: any) => `
                <li>
                  ${escapeHtml(formatTijd(shift.starttijd))}–${escapeHtml(formatTijd(shift.eindtijd))}
                  ${escapeHtml(normaliseerShiftNaam(shift.omschrijving || "Open dienst"))}
                </li>
              `
            )
            .join("")}
        </ul>
      `
      : `<p style="margin: 12px 0;">${badge("Geen open shifts", "groen")}</p>`;

  const klokurenHtml =
    Number(klokuren.aantal || 0) > 0
      ? `
        <p style="margin: 12px 0 6px 0;"><strong>Klokuren goed te keuren</strong></p>
        <p style="margin: 0 0 8px 0;">
          ${badge(`${klokuren.aantal} open`, "oranje")}
          ${
            klokuren.oudsteDatum
              ? `Oudste datum: <strong>${escapeHtml(formatDatum(klokuren.oudsteDatum))}</strong>`
              : ""
          }
        </p>
        <ul style="margin: 0 0 12px 20px; padding: 0;">
          ${(Array.isArray(klokuren.regels) ? klokuren.regels.slice(0, 6) : [])
            .map(
              (regel: any) => `
                <li>
                  ${escapeHtml(formatDatum(regel.datum))} – ${escapeHtml(regel.medewerkerNaam)}
                  ${regel.starttijd ? `(${escapeHtml(formatTijd(regel.starttijd))}${regel.eindtijd ? `–${escapeHtml(formatTijd(regel.eindtijd))}` : ""})` : ""}
                </li>
              `
            )
            .join("")}
        </ul>
      `
      : `<p style="margin: 12px 0;">${badge("Geen klokuren open", "groen")}</p>`;

  const jarigenHtml =
    jarigen.length > 0
      ? `
        <p style="margin: 12px 0 6px 0;"><strong>Jarig vandaag</strong></p>
        <ul style="margin: 0 0 12px 20px; padding: 0;">
          ${jarigen
            .map((persoon: any) => `<li>${escapeHtml(persoon.naam || persoon.email || "Medewerker")}</li>`)
            .join("")}
        </ul>
      `
      : `<p style="margin: 12px 0;">${badge("Niemand jarig", "grijs")}</p>`;

return section(
      "Personeel",
      `
        ${ingeplandHtml}
        ${openShiftHtml}
        ${klokurenHtml}
        ${jarigenHtml}
      `
    );
}

function renderSollicitanten(briefing: BriefingData) {
  const sollicitanten = briefing.onderdelen.sollicitanten;
  const afspraken = Array.isArray(sollicitanten.data) ? sollicitanten.data : [];

  if (sollicitanten.status === "fout") {
    return section(
      "Sollicitanten",
      `<p style="margin: 0;">${escapeHtml(sollicitanten.melding || "Sollicitatieafspraken niet beschikbaar.")}</p>`
    );
  }

  if (afspraken.length === 0) {
    return section(
      "Sollicitanten",
      `<p style="margin: 0;">${badge("Geen sollicitatieafspraken vandaag", "grijs")}</p>`
    );
  }

  return section(
    "Sollicitanten",
    `
      <ul style="margin: 0 0 0 20px; padding: 0;">
        ${afspraken
          .map((afspraak: any) => {
            const naam =
              afspraak.naam ||
              afspraak.name ||
              afspraak.invitee_name ||
              afspraak.inviteeName ||
              afspraak.title ||
              "Sollicitatieafspraak";

            const tijd =
              afspraak.tijd ||
              afspraak.time ||
              afspraak.start_time ||
              afspraak.startTime ||
              afspraak.start ||
              "";

            return `<li>${escapeHtml(formatTijd(tijd))} ${escapeHtml(naam)}</li>`;
          })
          .join("")}
      </ul>
    `
  );
}

function renderHaccp(briefing: BriefingData) {
  const haccp = briefing.onderdelen.haccp;

  if (haccp.status !== "ok") {
    return section(
      "HACCP / routines",
      `<p style="margin: 0;">${escapeHtml(haccp.melding || "HACCP niet beschikbaar.")}</p>`
    );
  }

  const data = haccp.data || {};
  const samenvatting = data.samenvatting || {};
  const routines = Array.isArray(data.routines) ? data.routines : [];
  const overdueTaken = Array.isArray(data.overdueTaken) ? data.overdueTaken : [];

  const kleurOpen = Number(samenvatting.openTaken || 0) > 0 ? "oranje" : "groen";
  const kleurOverdue = Number(samenvatting.overduePeriodiek || 0) > 0 ? "rood" : "groen";

  const routinesHtml = routines
    .map((routine: any) => {
      const open = Number(routine.openTaken || 0);
      const totaal = Number(routine.totaalTaken || 0);
      const afgerond = Number(routine.afgerondTaken || 0);

      return `
        <tr>
          <td style="padding: 7px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(routine.routineNaam)}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #e2e8f0;">${afgerond}/${totaal}</td>
          <td style="padding: 7px 8px; border-bottom: 1px solid #e2e8f0;">${open}</td>
        </tr>
      `;
    })
    .join("");

  const overdueHtml =
    overdueTaken.length > 0
      ? `
        <p style="margin: 14px 0 6px 0;"><strong>Overdue periodieke taken</strong></p>
        <ul style="margin: 0 0 0 20px; padding: 0;">
          ${overdueTaken
            .slice(0, 8)
            .map(
              (taak: any) => `
                <li>
                  ${escapeHtml(taak.routineNaam)} – ${escapeHtml(taak.taakNaam)}
                </li>
              `
            )
            .join("")}
        </ul>
      `
      : `<p style="margin: 12px 0 0 0;">${badge("Geen overdue periodieke taken", "groen")}</p>`;

  return section(
    "HACCP / routines",
    `
      <p style="margin: 0 0 12px 0;">
        ${badge(`${samenvatting.openTaken || 0} open`, kleurOpen as any)}
        ${badge(`${samenvatting.overduePeriodiek || 0} overdue periodiek`, kleurOverdue as any)}
        ${badge(`${samenvatting.overgeslagenVandaag || 0} overgeslagen`, "grijs")}
      </p>

      ${
        routinesHtml
          ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 14px;">
              <tr>
                <th align="left" style="padding: 7px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Routine</th>
                <th align="left" style="padding: 7px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Gedaan</th>
                <th align="left" style="padding: 7px 8px; border-bottom: 1px solid #cbd5e1; color: #475569;">Open</th>
              </tr>
              ${routinesHtml}
            </table>
          `
          : ""
      }

      ${overdueHtml}
    `
  );
}

function renderBijzonderheden(briefing: BriefingData) {
  const bijzonderheden = briefing.onderdelen.bijzonderheden;

  if (bijzonderheden.status !== "ok") {
    return section(
      "Bijzonderheden",
      `<p style="margin: 0;">${escapeHtml(bijzonderheden.melding || "Bijzonderheden niet beschikbaar.")}</p>`
    );
  }

  const feestdag = bijzonderheden.data?.feestdag;

  if (!feestdag) {
    return section(
      "Bijzonderheden",
      `<p style="margin: 0;">${badge("Geen bijzonderheid in eigen tabel", "grijs")}</p>`
    );
  }

  return section(
    "Bijzonderheden",
    `<p style="margin: 0;">${badge(feestdag, "blauw")}</p>`
  );
}

export function renderBriefingEmail(briefing: BriefingData) {
  const subject = `Dagbriefing Vincenzo - ${briefing.datumLabel}`;

  const html = `
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #f1f5f9;">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; max-width: 760px;">
            <tr>
              <td style="padding: 0 24px 18px 24px;">
                <div style="background: #0f172a; border-radius: 18px; padding: 24px;">
                  <h1 style="margin: 0 0 6px 0; font-size: 26px; line-height: 1.25; color: #ffffff;">
                    ${escapeHtml(briefing.titel || "Dagbriefing Vincenzo")}
                  </h1>
                  <p style="margin: 0; color: #cbd5e1; font-size: 15px;">
                    ${escapeHtml(briefing.datumLabel)}
                  </p>
                </div>
              </td>
            </tr>

            ${renderWeer(briefing)}
            ${renderPersoneel(briefing)}
            ${renderSollicitanten(briefing)}
            ${renderHaccp(briefing)}
            ${renderBijzonderheden(briefing)}

            <tr>
              <td style="padding: 0 24px 24px 24px; color: #64748b; font-size: 12px; line-height: 1.5;">
                Gegenereerd op ${escapeHtml(new Date(briefing.gegenereerdOp).toLocaleString("nl-NL", {
                  timeZone: "Europe/Amsterdam",
                }))}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const text = [
    `${briefing.titel || "Dagbriefing Vincenzo"} – ${briefing.datumLabel}`,
    "",
    "WEER & DRUKTEVERWACHTING",
    briefing.onderdelen.weer.data?.samenvatting || briefing.onderdelen.weer.melding || "",
    briefing.onderdelen.weer.data?.drukteverwachting || "",
    "",
    "PERSONEEL",
    `Ingepland vandaag: ${briefing.onderdelen.personeel.data?.ingepland?.length ?? 0}`,
    `Open shifts: ${briefing.onderdelen.personeel.data?.openShifts?.length ?? 0}`,
    `Klokuren goed te keuren: ${briefing.onderdelen.personeel.data?.klokurenGoedTeKeuren?.aantal ?? 0}`,
    `Jarig vandaag: ${briefing.onderdelen.personeel.data?.jarigVandaag?.length ?? 0}`,
    "",
    "SOLLICITANTEN",
    `Afspraken vandaag: ${briefing.onderdelen.sollicitanten.data?.length ?? 0}`,
    "",
    "HACCP / ROUTINES",
    `Open taken: ${briefing.onderdelen.haccp.data?.samenvatting?.openTaken ?? 0}`,
    `Overdue periodiek: ${briefing.onderdelen.haccp.data?.samenvatting?.overduePeriodiek ?? 0}`,
    "",
    "BIJZONDERHEDEN",
    briefing.onderdelen.bijzonderheden.data?.feestdag || "Geen bijzonderheid in eigen tabel.",
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}