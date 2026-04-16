type DagrapportResponse = {
  success: boolean;
  datum: string;
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

function getRoutineLabel(slug: string, fallback: string) {
  switch (slug) {
    case "keuken-opstart":
      return "Start keuken";
    case "keuken-afsluit":
      return "Einde keuken";
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

export function renderDagrapportEmail(data: DagrapportResponse) {
  const datumLabel = formatDatum(data.datum);

  const haccpHtml = data.haccp.length
    ? data.haccp
        .map((groep) => {
          const routineTitel = getRoutineLabel(groep.routineSlug, groep.routineNaam);
          const statusLabel = groep.compleet ? "Compleet" : "Incompleet";
          const statusBg = groep.compleet ? "#dcfce7" : "#fee2e2";
          const statusColor = groep.compleet ? "#166534" : "#991b1b";

          const takenHtml = groep.taken
            .map((taak) => {
              const done = taak.afgetekend;
              const icon = done ? "✅" : "❌";
              const naam = done
                ? `${escapeHtml(taak.afgetekendDoorNaam || "")}${
                    taak.afgetekendOp ? ` · ${formatTijd(taak.afgetekendOp)}` : ""
                  }`
                : "niet afgehandeld";

              return `
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
                    ${escapeHtml(taak.taakNaam)}
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:${
                    done ? "#166534" : "#991b1b"
                  };white-space:nowrap;">
                    ${icon} ${escapeHtml(naam)}
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

          <div style="margin-bottom:28px;">
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
              HACCP
            </div>
            ${haccpHtml}
          </div>

          <div>
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;color:#0f172a;">
              Productie
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