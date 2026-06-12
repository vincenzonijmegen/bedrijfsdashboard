import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mail.infomaniak.com",
  port: 465,
  secure: true,
  auth: {
    user: "bestelling@ijssalonvincenzo.nl",
    pass: process.env.EMAIL_PASSWORD!,
  },
});

function esc(v: string | null | undefined) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendBeschikbaarheidsOpgaveMail({
  naar,
  naam,
  rondeNaam,
  startDatum,
  eindDatum,
  deadline,
  link,
  toelichting,
  herinnering = false,
}: {
  naar: string;
  naam: string;
  rondeNaam: string;
  startDatum: string;
  eindDatum: string;
  deadline?: string | null;
  link: string;
  toelichting?: string | null;
  herinnering?: boolean;
}) {
  if (!process.env.EMAIL_PASSWORD) {
    throw new Error("EMAIL_PASSWORD ontbreekt voor beschikbaarheidsmail.");
  }

  const subject = herinnering
    ? `Herinnering: vul je beschikbaarheid in voor ${rondeNaam}`
    : `Beschikbaarheid doorgeven voor ${rondeNaam}`;

  const periode = `${new Date(startDatum).toLocaleDateString("nl-NL")} t/m ${new Date(
    eindDatum
  ).toLocaleDateString("nl-NL")}`;

  const deadlineTekst = deadline
    ? `Vul dit bij voorkeur uiterlijk ${new Date(deadline).toLocaleDateString("nl-NL")} in.`
    : "Vul dit zo snel mogelijk in.";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.55;">
      <p>Hoi ${esc(naam)},</p>
      <p>${
        herinnering
          ? "Je gaf eerder aan dat je je beschikbaarheid nog niet wist, of je hebt nog niet gereageerd."
          : "We vragen je om je beschikbaarheid opnieuw door te geven."
      }</p>

      <p>
        <strong>Periode:</strong> ${esc(periode)}<br>
        <strong>Uitvraag:</strong> ${esc(rondeNaam)}
      </p>

      ${
        toelichting
          ? `<div style="border-left:4px solid #2563eb;padding:8px 12px;background:#eff6ff;margin:12px 0;">${esc(
              toelichting
            ).replace(/\n/g, "<br>")}</div>`
          : ""
      }

      <p>${esc(deadlineTekst)}</p>

      <p>
        <a href="${esc(link)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:bold;">
          Beschikbaarheid invullen
        </a>
      </p>

      <p>
        Via de link kun je je beschikbaarheid invullen, aangeven dat je het nog niet weet,
        of doorgeven dat je voor deze periode niet beschikbaar bent.
      </p>

      <p>Groet,<br><strong>Erik en Herman</strong></p>
    </div>
  `;

  const text =
    `Hoi ${naam},\n\n` +
    `${
      herinnering
        ? "Herinnering: vul je beschikbaarheid alsnog in."
        : "We vragen je om je beschikbaarheid opnieuw door te geven."
    }\n\n` +
    `Periode: ${periode}\n` +
    `Uitvraag: ${rondeNaam}\n\n` +
    `${toelichting || ""}\n\n` +
    `${deadlineTekst}\n\n` +
    `Link: ${link}\n\n` +
    `Groet,\nErik en Herman`;

  console.log("📧 Beschikbaarheidsmail verzenden:", {
    naar,
    subject,
    link,
  });

  const result = await transporter.sendMail({
    from: "IJssalon Vincenzo <bestelling@ijssalonvincenzo.nl>",
    to: naar,
    replyTo: "herman@ijssalonvincenzo.nl",
    subject,
    text,
    html,
  });

  console.log("📧 Beschikbaarheidsmail resultaat:", {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
  });

  if (!result.accepted || result.accepted.length === 0) {
    throw new Error(
      `Beschikbaarheidsmail niet geaccepteerd door SMTP. Rejected: ${JSON.stringify(
        result.rejected || []
      )}`
    );
  }

  return result;
}