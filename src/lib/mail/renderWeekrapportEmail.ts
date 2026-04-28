// src/lib/mail/renderWeekrapportEmail.ts

type WeekrapportResponse = {
  success: boolean;
  startDatum: string;
  eindDatum: string;
  dagen: {
    datum: string;
    omzet: number;
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

export function renderWeekrapportEmail(data: WeekrapportResponse) {
  const periode = `${formatDatum(data.startDatum)} t/m ${formatDatum(data.eindDatum)}`;

  const rowsHtml = data.dagen
    .map(
      (dag) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
            ${escapeHtml(formatDatum(dag.datum))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:800;color:#0f172a;text-align:right;">
            ${escapeHtml(formatEuro(dag.omzet))}
          </td>
        </tr>
      `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="nl">
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:860px;margin:0 auto;padding:24px;">
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
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">Weekomzet</td>
                <td style="padding:14px 16px;background:#ecfeff;border-radius:14px;text-align:right;font-weight:800;color:#155e75;">
                  ${escapeHtml(formatEuro(data.totaalOmzet))}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">Gemiddelde per dag</td>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;text-align:right;font-weight:800;">
                  ${escapeHtml(formatEuro(data.gemiddeldeOmzet))}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-radius:14px;font-weight:700;">Beste dag</td>
                <td style="padding:14px 16px;background:#f0fdf4;border-radius:14px;text-align:right;font-weight:800;color:#166534;">
                  ${
                    data.besteDag
                      ? `${escapeHtml(formatDatum(data.besteDag.datum))} · ${escapeHtml(formatEuro(data.besteDag.omzet))}`
                      : "-"
                  }
                </td>
              </tr>
            </table>
          </div>

          <div style="padding:20px;border:1px solid #e5e7eb;border-radius:20px;background:#ffffff;">
            <div style="margin-bottom:12px;font-size:24px;font-weight:800;">
              Omzet per dag
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
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