type DagrapportResponse = {
  success: boolean;
  datum: string;
  dagomzet: number | null;
  weer: {
    omschrijving: string;
    minTemp: number | null;
    maxTemp: number | null;
    neerslag: number | null;
  } | null;
  omzetPerUur: {
    uur: string;
    omzet: number;
  }[];
  haccp: {
    routineId: number | string;
    routineNaam: string;
    routineSlug: string;
    locatie: string;
    type: string;
    compleet: boolean;
    totaalTaken: number;
    gedaanTaken: number;
taken: {
  taakId: number | string;
  taakNaam: string;
  afgetekend: boolean;
  afgetekendDoorNaam: string | null;
  afgetekendOp: string | null;
  status?: "gedaan" | "overgeslagen" | null;
  bron?: "medewerker" | "leiding" | null;
  overgeslagenReden?: string | null;
}[];
  }[];
 productie: {
  categorie: string;
  totaal: number;
  items: {
    naam: string;
    aantal: number;
  }[];
}[];

rotaties?: {
  datum: string;
  rotatieNaam: string;
  taakNaam: string;
  afgetekendDoorNaam: string | null;
  afgetekendOp: string | null;
}[];
};


function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDatum(datum: string) {
  const d = new Date(`${datum}T00:00:00`);
  return d.toLocaleDateString("nl-NL");
}

function formatTijd(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEuro(value: number | null | undefined) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDagomzet(value: number | null | undefined) {
  if (value == null) return "nog niet beschikbaar";
  return formatEuro(value);
}

function formatGetal(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function getOmzetHeatStyle(omzet: number, min: number, max: number) {
  if (max <= 0) {
    return {
      bg: "#f8fafc",
      color: "#0f172a",
    };
  }

  if (max === min) {
    return {
      bg: "#dbeafe",
      color: "#1e3a8a",
    };
  }

  const ratio = (omzet - min) / (max - min);

  if (ratio >= 0.85) {
    return { bg: "#1d4ed8", color: "#ffffff" };
  }
  if (ratio >= 0.65) {
    return { bg: "#60a5fa", color: "#0f172a" };
  }
  if (ratio >= 0.45) {
    return { bg: "#93c5fd", color: "#0f172a" };
  }
  if (ratio >= 0.25) {
    return { bg: "#bfdbfe", color: "#0f172a" };
  }

  return { bg: "#eff6ff", color: "#334155" };
}

function getRoutineLabel(slug: string, fallback: string) {
  switch (slug) {
    case "keuken-opstart":
      return "Start keuken";
    case "keuken-afsluit":
      return "Einde keuken";
    case "keuken-eindschoonmaak":
      return "Keuken eindschoonmaak";
    case "winkel-opstart":
      return "Start winkel";
    case "winkel-afsluit":
      return "Einde winkel";
    default:
      return fallback;
  }
}

function getCategorieLabel(categorie: string) {
  switch (categorie.toLowerCase()) {
    case "melksmaken":
      return "Melksmaken";
    case "sorbetsmaken":
      return "Sorbetsmaken";
    case "specials":
      return "Specials";
    case "suikervrij":
      return "Suikervrij";
    default:
      return categorie;
  }
}

function getStatusLabel(gedaan: number, totaal: number) {
  if (totaal === 0) {
    return {
      tekst: "Geen taken",
      bg: "#e2e8f0",
      color: "#334155",
    };
  }

  if (gedaan === totaal) {
    return {
      tekst: "Compleet",
      bg: "#dcfce7",
      color: "#166534",
    };
  }

  if (gedaan === 0) {
    return {
      tekst: "Niet gestart",
      bg: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    tekst: "Incompleet",
    bg: "#fef3c7",
    color: "#92400e",
  };
}

function getWeerLabel(omschrijving: string) {
  if (!omschrijving) return "Onbekend";
  return omschrijving.charAt(0).toUpperCase() + omschrijving.slice(1);
}

export function renderDagrapportEmail(data: DagrapportResponse) {
  const datumLabel = formatDatum(data.datum);

  const haccpSamenvatting = data.haccp.map((groep) => {
    const routineTitel = getRoutineLabel(groep.routineSlug, groep.routineNaam);
    const ontbrekend = groep.totaalTaken - groep.gedaanTaken;
    const status = getStatusLabel(groep.gedaanTaken, groep.totaalTaken);

    return {
      titel: routineTitel,
      gedaan: groep.gedaanTaken,
      totaal: groep.totaalTaken,
      ontbrekend,
      status,
    };
  });

  const productieSamenvatting = data.productie.map((groep) => ({
    categorie: getCategorieLabel(groep.categorie),
    totaal: groep.totaal,
  }));

  const totaalProductie = data.productie.reduce(
    (sum, groep) => sum + groep.totaal,
    0
  );

  const afwijkendeTaken = data.haccp.flatMap((groep) => {
  const routineTitel = getRoutineLabel(groep.routineSlug, groep.routineNaam);

  return groep.taken
    .filter((taak) => !taak.afgetekend || taak.status === "overgeslagen")
    .map((taak) => ({
      routineTitel,
      taakNaam: taak.taakNaam,
      afgetekend: taak.afgetekend,
      status: taak.status,
      bron: taak.bron,
      afgetekendDoorNaam: taak.afgetekendDoorNaam,
      afgetekendOp: taak.afgetekendOp,
      overgeslagenReden: taak.overgeslagenReden,
    }));
});

  const belangrijkHtml =
  afwijkendeTaken.length > 0
    ? `
      <div style="margin:0 0 28px 0;padding:18px;border:1px solid #fed7aa;border-radius:18px;background:#fff7ed;">
        <div style="font-size:18px;font-weight:800;color:#9a3412;margin-bottom:10px;">
          ⚠️ Belangrijk
        </div>
        <div style="font-size:14px;color:#7c2d12;margin-bottom:10px;">
          De volgende HACCP-punten vragen aandacht:
        </div>
        <ul style="margin:0;padding-left:20px;color:#7c2d12;font-size:14px;line-height:1.6;">
          ${afwijkendeTaken
            .map((item) => {
              const isOvergeslagen = item.status === "overgeslagen";

              return `
                <li>
                  <strong>${escapeHtml(item.routineTitel)}</strong>: ${escapeHtml(
                    item.taakNaam
                  )}
                  ${
                    isOvergeslagen
                      ? `<br /><span style="color:#9a3412;">
                          Geautoriseerd overgeslagen door ${escapeHtml(
                            item.afgetekendDoorNaam || "leiding"
                          )}${
                          item.afgetekendOp
                            ? ` · ${escapeHtml(formatTijd(item.afgetekendOp))}`
                            : ""
                        }${
                          item.overgeslagenReden
                            ? `<br />Reden: ${escapeHtml(item.overgeslagenReden)}`
                            : ""
                        }
                        </span>`
                      : `<br /><span style="color:#991b1b;">Niet afgehandeld</span>`
                  }
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `
    : `
      <div style="margin:0 0 28px 0;padding:18px;border:1px solid #bbf7d0;border-radius:18px;background:#f0fdf4;">
        <div style="font-size:18px;font-weight:800;color:#166534;">
          ✅ Belangrijk
        </div>
        <div style="margin-top:8px;font-size:14px;color:#166534;">
          Geen openstaande of afwijkende HACCP-punten op ${escapeHtml(datumLabel)}.
        </div>
      </div>
    `;

  const samenvattingKernHtml = `
    <div style="margin-bottom:20px;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px;">
        Kerncijfers
      </div>

      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
        <tbody>
          <tr>
            <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px 0 0 14px;font-size:15px;font-weight:700;color:#0f172a;">
              Dagomzet gisteren
            </td>
            <td style="padding:14px 16px;background:#ecfeff;border:1px solid #e5e7eb;border-left:none;border-radius:0 14px 14px 0;font-size:15px;font-weight:800;color:#155e75;text-align:right;white-space:nowrap;">
              ${escapeHtml(formatDagomzet(data.dagomzet))}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px 0 0 14px;font-size:15px;font-weight:700;color:#0f172a;">
              Weer gisteren
            </td>
            <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-left:none;border-radius:0 14px 14px 0;font-size:14px;font-weight:700;color:#334155;text-align:right;">
              ${
                data.weer
                  ? `
                    ${escapeHtml(getWeerLabel(data.weer.omschrijving))}
                    ${
                      data.weer.maxTemp !== null
                        ? ` · max ${escapeHtml(formatGetal(data.weer.maxTemp))}°C`
                        : ""
                    }
                    ${
                      data.weer.minTemp !== null
                        ? ` · min ${escapeHtml(formatGetal(data.weer.minTemp))}°C`
                        : ""
                    }
                    ${
                      data.weer.neerslag !== null
                        ? ` · ${escapeHtml(formatGetal(data.weer.neerslag))} mm`
                        : ""
                    }
                  `
                  : `Geen weergegevens beschikbaar`
              }
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const samenvattingHaccpHtml = haccpSamenvatting.length
    ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px;">
          HACCP
        </div>
        <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
          <tbody>
            ${haccpSamenvatting
              .map(
                (groep) => `
                  <tr>
                    <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px 0 0 14px;font-size:15px;font-weight:700;color:#0f172a;">
                      ${escapeHtml(groep.titel)}
                    </td>
                    <td style="padding:14px 16px;background:#ffffff;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#334155;white-space:nowrap;">
                      ${groep.gedaan}/${groep.totaal}
                    </td>
                    <td style="padding:14px 16px;background:#ffffff;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:14px;color:${
                      groep.ontbrekend > 0 ? "#991b1b" : "#166534"
                    };white-space:nowrap;">
                      ${
                        groep.ontbrekend > 0
                          ? `${groep.ontbrekend} niet gedaan`
                          : "Alles gedaan"
                      }
                    </td>
                    <td style="padding:14px 16px;background:${groep.status.bg};border:1px solid #e5e7eb;border-left:none;border-radius:0 14px 14px 0;font-size:13px;font-weight:800;color:${groep.status.color};white-space:nowrap;text-align:right;">
                      ${groep.status.tekst}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `
      <div style="margin-bottom:20px;padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
        Geen HACCP-samenvatting beschikbaar.
      </div>
    `;

  const samenvattingProductieHtml =
    productieSamenvatting.length > 0
      ? `
        <div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px;">
            Productie
          </div>
          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
            <tbody>
              ${productieSamenvatting
                .map(
                  (groep) => `
                    <tr>
                      <td style="padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px 0 0 14px;font-size:15px;font-weight:700;color:#0f172a;">
                        ${escapeHtml(groep.categorie)}
                      </td>
                      <td style="padding:14px 16px;background:#e0f2fe;border:1px solid #e5e7eb;border-left:none;border-radius:0 14px 14px 0;font-size:13px;font-weight:800;color:#075985;white-space:nowrap;text-align:right;">
                        ${groep.totaal}
                      </td>
                    </tr>
                  `
                )
                .join("")}
              <tr>
                <td style="padding:14px 16px;background:#0f172a;border-radius:14px 0 0 14px;font-size:15px;font-weight:800;color:#ffffff;">
                  Totaal productie-items
                </td>
                <td style="padding:14px 16px;background:#0f172a;border-radius:0 14px 14px 0;font-size:15px;font-weight:800;color:#ffffff;text-align:right;">
                  ${totaalProductie}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `
      : `
        <div style="padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
          Geen productie geregistreerd.
        </div>
      `;

      const omzetWaarden = data.omzetPerUur.map((item) => item.omzet);
  const minOmzet = omzetWaarden.length ? Math.min(...omzetWaarden) : 0;
  const maxOmzet = omzetWaarden.length ? Math.max(...omzetWaarden) : 0;

  const omzetPerUurHtml = data.omzetPerUur.length
    ? `
      <div style="margin:0 0 28px 0;">
        <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
          Omzetverdeling per uur
        </div>

        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">
                  Uur
                </th>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:13px;color:#475569;">
                  Omzet
                </th>
              </tr>
            </thead>
            <tbody>
              ${data.omzetPerUur
                .map((item) => {
                  const heat = getOmzetHeatStyle(item.omzet, minOmzet, maxOmzet);

                  return `
                    <tr>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
                        ${escapeHtml(item.uur)}
                      </td>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:800;text-align:right;white-space:nowrap;background:${heat.bg};color:${heat.color};">
                        ${escapeHtml(formatEuro(item.omzet))}
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

          <div style="margin-top:12px;font-size:12px;color:#64748b;">
            Licht = rustiger uur · donkerder = drukker uur
          </div>
        </div>
      </div>
    `
    : `
      <div style="margin:0 0 28px 0;">
        <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
          Omzetverdeling per uur
        </div>
        <div style="padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
          Geen omzetgegevens beschikbaar.
        </div>
      </div>
    `;

  const rotaties = data.rotaties || [];

  const rotatiesHtml = rotaties.length
    ? `
      <div style="margin:0 0 28px 0;">
        <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
          Rotaties
        </div>

        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
          <div style="margin-bottom:10px;font-size:14px;color:#475569;">
            Laatste 7 uitgevoerde rotaties
          </div>

          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">
                  Datum
                </th>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">
                  Groep
                </th>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">
                  Taak
                </th>
                <th style="padding:10px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:13px;color:#475569;">
                  Afgetekend
                </th>
              </tr>
            </thead>
            <tbody>
              ${rotaties
                .map(
                  (item) => `
                    <tr>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;white-space:nowrap;">
                        ${escapeHtml(formatDatum(item.datum))}
                      </td>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;white-space:nowrap;">
                        ${escapeHtml(item.rotatieNaam)}
                      </td>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
                        ${escapeHtml(item.taakNaam)}
                      </td>
                      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#475569;text-align:right;white-space:nowrap;">
                        ${escapeHtml(item.afgetekendDoorNaam || "-")}
                        ${
                          item.afgetekendOp
                            ? ` · ${escapeHtml(formatTijd(item.afgetekendOp))}`
                            : ""
                        }
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
    : `
      <div style="margin:0 0 28px 0;">
        <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
          Rotaties
        </div>
        <div style="padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
          Geen rotaties gevonden.
        </div>
      </div>
    `;


  const haccpHtml = data.haccp.length
    ? data.haccp
        .map((groep) => {
          const routineTitel = getRoutineLabel(groep.routineSlug, groep.routineNaam);
          const statusLabel = groep.compleet ? "Compleet" : "Incompleet";
          const statusBg = groep.compleet ? "#dcfce7" : "#fee2e2";
          const statusColor = groep.compleet ? "#166534" : "#991b1b";

          const afwijkendeTakenInGroep = groep.taken.filter(
  (taak) => !taak.afgetekend || taak.status === "overgeslagen"
);

if (afwijkendeTakenInGroep.length === 0) {
  return "";
}

const takenHtml = afwijkendeTakenInGroep
  .map((taak) => {
const isOvergeslagen = taak.status === "overgeslagen";
const icon = isOvergeslagen ? "⚠️" : "❌";
const tekst = isOvergeslagen
  ? `Geautoriseerd overgeslagen door ${escapeHtml(
      taak.afgetekendDoorNaam || "leiding"
    )}${
      taak.afgetekendOp ? ` · ${escapeHtml(formatTijd(taak.afgetekendOp))}` : ""
    }${
      taak.overgeslagenReden
        ? ` · Reden: ${escapeHtml(taak.overgeslagenReden)}`
        : ""
    }`
  : "niet afgehandeld";

              return `
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
                    ${escapeHtml(taak.taakNaam)}
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:${
                    isOvergeslagen ? "#9a3412" : "#991b1b"
                  };white-space:nowrap;">
                    ${icon} ${escapeHtml(tekst)}
                  </td>
                </tr>
              `;
            })
            .join("");

          return `
            <div style="margin:0 0 20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                <div style="font-size:20px;font-weight:700;color:#0f172a;">
                  ${escapeHtml(routineTitel)}
                </div>
                <div style="padding:6px 10px;border-radius:999px;background:${statusBg};color:${statusColor};font-size:13px;font-weight:700;">
                  ${statusLabel} · ${groep.gedaanTaken}/${groep.totaalTaken}
                </div>
              </div>

              <table role="presentation" style="width:100%;border-collapse:collapse;">
                <tbody>
                  ${takenHtml}
                </tbody>
              </table>
            </div>
          `;
        })
        .join("")
    : `
      <div style="padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
        Geen HACCP-gegevens gevonden.
      </div>
    `;

  const productieHtml = data.productie.length
    ? data.productie
        .map((groep) => {
          const itemsHtml = groep.items
            .map(
              (item) => `
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
                    ${escapeHtml(item.naam)}
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap;">
                    ${item.aantal}x
                  </td>
                </tr>
              `
            )
            .join("");

          return `
            <div style="margin:0 0 20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                <div style="font-size:20px;font-weight:700;color:#0f172a;">
                  ${escapeHtml(getCategorieLabel(groep.categorie))}
                </div>
                <div style="padding:6px 10px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:13px;font-weight:700;">
                  Totaal ${groep.totaal}
                </div>
              </div>

              <table role="presentation" style="width:100%;border-collapse:collapse;">
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>
          `;
        })
        .join("")
    : `
      <div style="padding:16px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;color:#475569;font-size:14px;">
        Geen productie geregistreerd.
      </div>
    `;

  const html = `
    <!DOCTYPE html>
    <html lang="nl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Dagrapportage ${escapeHtml(datumLabel)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:960px;margin:0 auto;padding:24px;">
          <div style="margin-bottom:24px;padding:24px;border-radius:20px;background:#0f172a;color:#ffffff;">
            <div style="font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.8;">
              Dagrapportage
            </div>
            <div style="margin-top:8px;font-size:32px;font-weight:800;">
              IJssalon Vincenzo
            </div>
            <div style="margin-top:8px;font-size:16px;opacity:.9;">
              Overzicht van ${escapeHtml(datumLabel)}
            </div>
          </div>

          <div style="margin-bottom:28px;padding:20px;border:1px solid #e5e7eb;border-radius:20px;background:#f8fafc;">
            <div style="margin-bottom:18px;font-size:24px;font-weight:800;color:#0f172a;">
              Samenvatting
            </div>

            ${samenvattingKernHtml}
            ${samenvattingHaccpHtml}
            ${samenvattingProductieHtml}
          </div>

                  ${belangrijkHtml}

          ${rotatiesHtml}

          ${omzetPerUurHtml}

          <div style="margin-bottom:28px;">
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
              HACCP detail
            </div>
            ${haccpHtml}
          </div>

          <div>
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
              Productie detail
            </div>
            ${productieHtml}
          </div>
        </div>
      </body>
    </html>
  `;

  const subject = `Dagrapportage IJssalon Vincenzo – ${datumLabel}`;

  return { subject, html };
}