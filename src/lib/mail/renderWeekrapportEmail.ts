type WeekrapportResponse = {
  success: boolean;
  startDatum: string;
  eindDatum: string;
  dagen: {
    datum: string;
    omzet: number;
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
    druksteUur: {
      uur: string;
      omzet: number;
    } | null;
  }[];
  totaalOmzet: number;
  gemiddeldeOmzet: number;
  besteDag: {
    datum: string;
    omzet: number;
  } | null;
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
  return new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatGetal(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function getWeerLabel(
  weer: WeekrapportResponse["dagen"][number]["weer"]
) {
  if (!weer) return "Geen weergegevens";

  const omschrijving =
    weer.omschrijving.charAt(0).toUpperCase() + weer.omschrijving.slice(1);

  const delen = [omschrijving];

  if (weer.maxTemp !== null) delen.push(`max ${formatGetal(weer.maxTemp)}°C`);
  if (weer.minTemp !== null) delen.push(`min ${formatGetal(weer.minTemp)}°C`);
  if (weer.neerslag !== null) delen.push(`${formatGetal(weer.neerslag)} mm`);

  return delen.join(" · ");
}
function getOmzetHeatStyle(omzet: number, min: number, max: number) {
  if (max <= 0) {
    return { bg: "#f8fafc", color: "#0f172a" };
  }

  if (max === min) {
    return { bg: "#dbeafe", color: "#1e3a8a" };
  }

  const ratio = (omzet - min) / (max - min);

  if (ratio >= 0.85) return { bg: "#1d4ed8", color: "#ffffff" };
  if (ratio >= 0.65) return { bg: "#60a5fa", color: "#0f172a" };
  if (ratio >= 0.45) return { bg: "#93c5fd", color: "#0f172a" };
  if (ratio >= 0.25) return { bg: "#bfdbfe", color: "#0f172a" };

  return { bg: "#eff6ff", color: "#334155" };
}

export function renderWeekrapportEmail(data: WeekrapportResponse) {
  const periode = `${formatDatum(data.startDatum)} t/m ${formatDatum(
    data.eindDatum
  )}`;

  const dagRowsHtml = data.dagen
    .map(
      (dag) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
            ${escapeHtml(formatDatum(dag.datum))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#475569;">
            ${escapeHtml(getWeerLabel(dag.weer))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#475569;text-align:right;white-space:nowrap;">
            ${
              dag.druksteUur
                ? `${escapeHtml(dag.druksteUur.uur)} · ${escapeHtml(
                    formatEuro(dag.druksteUur.omzet)
                  )}`
                : "-"
            }
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:800;color:#0f172a;text-align:right;white-space:nowrap;">
            ${escapeHtml(formatEuro(dag.omzet))}
          </td>
        </tr>
      `
    )
    .join("");

  const uurVerdelingHtml = data.dagen
  .map((dag) => {
    const waarden = dag.omzetPerUur.map((u) => u.omzet);
    const min = waarden.length ? Math.min(...waarden) : 0;
    const max = waarden.length ? Math.max(...waarden) : 0;

    const urenHtml = dag.omzetPerUur.length
      ? dag.omzetPerUur
          .map((item) => {
            let bg = "#eff6ff";
            let color = "#334155";

            if (max > 0 && max !== min) {
              const ratio = (item.omzet - min) / (max - min);

              if (ratio >= 0.85) {
                bg = "#1d4ed8";
                color = "#ffffff";
              } else if (ratio >= 0.65) {
                bg = "#60a5fa";
                color = "#0f172a";
              } else if (ratio >= 0.45) {
                bg = "#93c5fd";
                color = "#0f172a";
              } else if (ratio >= 0.25) {
                bg = "#bfdbfe";
                color = "#0f172a";
              }
            }

            return `
              <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">
                  ${escapeHtml(item.uur)}
                </td>
                <td style="
                  padding:8px 10px;
                  border-bottom:1px solid #e5e7eb;
                  font-size:13px;
                  font-weight:800;
                  text-align:right;
                  background:${bg};
                  color:${color};
                ">
                  ${escapeHtml(formatEuro(item.omzet))}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="2" style="padding:10px;font-size:13px;color:#64748b;">
            Geen omzetgegevens.
          </td>
        </tr>
      `;

    return `
      <div style="margin:0 0 18px 0;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
        <div style="margin-bottom:4px;font-size:18px;font-weight:800;color:#0f172a;">
          ${escapeHtml(formatDatum(dag.datum))}
        </div>
        <div style="margin-bottom:12px;font-size:13px;color:#475569;">
          ${escapeHtml(getWeerLabel(dag.weer))}
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${urenHtml}
          </tbody>
        </table>
      </div>
    `;
  })
  .join("");
  const html = `
    <!DOCTYPE html>
    <html lang="nl">
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:960px;margin:0 auto;padding:24px;">
          <div style="margin-bottom:24px;padding:24px;border-radius:20px;background:#0f172a;color:#ffffff;">
            <div style="font-size:14px;font-weight:700;text-transform:uppercase;opacity:.8;">
              Weekrapportage
            </div>
            <div style="margin-top:8px;font-size:32px;font-weight:800;">
              IJssalon Vincenzo
            </div>
            <div style="margin-top:8px;font-size:16px;opacity:.9;">
              ${escapeHtml(periode)}
            </div>
          </div>

          <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:20px;background:#ffffff;">
            <table style="width:100%;border-collapse:separate;border-spacing:0 10px;">
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">
                  Weekomzet
                </td>
                <td style="padding:14px 16px;background:#ecfeff;border-radius:14px;text-align:right;font-weight:800;color:#155e75;">
                  ${escapeHtml(formatEuro(data.totaalOmzet))}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">
                  Gemiddelde per dag
                </td>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;text-align:right;font-weight:800;">
                  ${escapeHtml(formatEuro(data.gemiddeldeOmzet))}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">
                  Beste dag
                </td>
                <td style="padding:14px 16px;background:#f0fdf4;border-radius:14px;text-align:right;font-weight:800;color:#166534;">
                  ${
                    data.besteDag
                      ? `${escapeHtml(formatDatum(data.besteDag.datum))} · ${escapeHtml(
                          formatEuro(data.besteDag.omzet)
                        )}`
                      : "-"
                  }
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:20px;background:#ffffff;">
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;">
              Dagoverzicht
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">Dag</th>
                  <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:13px;color:#475569;">Weer</th>
                  <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:13px;color:#475569;">Drukste uur</th>
                  <th style="padding:12px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:13px;color:#475569;">Omzet</th>
                </tr>
              </thead>
              <tbody>
                ${dagRowsHtml}
              </tbody>
            </table>
          </div>

          <div>
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;">
              Omzet per uur per dag
            </div>
            ${uurVerdelingHtml}
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    subject: `Weekrapportage IJssalon Vincenzo – ${periode}`,
    html,
  };
}