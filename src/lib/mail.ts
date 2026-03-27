import { Resend } from "resend";
import nodemailer from "nodemailer";

export async function sendUitnodiging(email: string, naam: string, wachtwoord: string) {
  const subject = "Je werkinstructie-account bij IJssalon Vincenzo";
  const body = `
    <p>Hallo ${naam},</p>
    <p>Je bent toegevoegd aan het werkinstructiesysteem van IJssalon Vincenzo.</p>
    <p><strong>Loginpagina:</strong> <a href="https://werkinstructies-app.vercel.app/sign-in">klik hier om in te loggen</a></p>
    <p><strong>Tijdelijk wachtwoord:</strong> ${wachtwoord}</p>
    <p>Wijzig dit wachtwoord na je eerste login.</p>
    <p>Met vriendelijke groet,<br/>Erik en Herman</p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: email,
    subject,
    html: body,
  });

  console.log("✅ Resend result:", result);
}

export async function sendSkillMail(email: string, naam: string, skillnaam: string, deadline: number) {
  const subject = `📘 Nieuwe skill toegewezen: ${skillnaam}`;
  const body = `
    <p>Hallo ${naam},</p>
    <p>Je hebt een nieuwe skill toegewezen gekregen: <strong>${skillnaam}</strong>.</p>
    <p>Deze moet je binnen <strong>${deadline}</strong> dagen leren.</p>
    <p>Bekijk je skills via het werkinstructieportaal.</p>
    <p>Met vriendelijke groet,<br/>Erik en Herman</p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: email,
    subject,
    html: body,
  });

  console.log("✅ Skillmail verzonden:", result);
}

export async function sendReminderMail(email: string, naam: string, skillnaam: string, deadline: Date) {
  const datum = deadline.toLocaleDateString("nl-NL");
  const subject = `⏰ Herinnering: leer "${skillnaam}" voor ${datum}`;
  const body = `
    <p>Beste ${naam},</p>
    <p>Je hebt nog 3 dagen om de skill <strong>${skillnaam}</strong> te leren.</p>
    <p>Deadline: <strong>${datum}</strong></p>
    <p>Groet,<br>Erik en Herman</p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: email,
    subject,
    html: body,
  });

  console.log("✅ Herinneringsmail verzonden:", result);
}

export async function sendVraagMeldingAanLeiding(naam: string, email: string, vraag: string) {
  const subject = `📩 Nieuwe vraag van ${naam}`;
  const body = `
    <p>Er is een nieuwe vraag binnengekomen in het werkinstructieportaal.</p>
    <p><strong>Van:</strong> ${naam} (${email})</p>
    <p><strong>Vraag:</strong></p>
    <blockquote>${vraag}</blockquote>
    <p>Bekijk de vraag in het dashboard:</p>
    <p><a href="https://werkinstructies-app.vercel.app/admin/vragen">Open dashboard</a></p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
    to: "info@ijssalonvincenzo.nl",
    subject,
    html: body,
  });

  console.log("📧 Vraagmelding verzonden:", result);
}

const infomaniakTransporter = nodemailer.createTransport({
  host: "mail.infomaniak.com",
  port: 465,
  secure: true,
  auth: {
    user: "bestelling@ijssalonvincenzo.nl",
    pass: process.env.EMAIL_PASSWORD!,
  },
});

export async function sendBestellingMail(
  naar: string,
  onderwerp: string,
  tekst: string
) {
  const html = tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const result = await infomaniakTransporter.sendMail({
    from: "IJssalon Vincenzo <bestelling@ijssalonvincenzo.nl>",
    to: naar,
    replyTo: "herman@ijssalonvincenzo.nl",
    subject: onderwerp,
    text: tekst,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111827;">
      <p>Beste,</p>
      <p>Hierbij onze bestelling.</p>
      <p>${html}</p>
      <p>Met vriendelijke groet,<br><strong>IJssalon Vincenzo</strong></p>
    </div>`,
  });

  console.log("✅ Bestelmail verzonden via Infomaniak:", result);
}

function esc(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactMail({
  naam,
  email,
  bericht,
}: {
  naam: string;
  email: string;
  bericht: string;
}) {
  const subject = "Contactformulier – IJssalon Vincenzo";
  const text =
    `Nieuw bericht via het contactformulier\n` +
    `====================================\n\n` +
    `Naam: ${naam}\n` +
    `E-mail: ${email}\n\n` +
    `Bericht:\n${bericht}\n`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;">
      <h2 style="margin:0 0 12px 0;">Nieuw bericht via het contactformulier</h2>
      <p><strong>Naam:</strong> ${esc(naam)}<br>
      <strong>E-mail:</strong> ${esc(email)}</p>
      <h3 style="margin:16px 0 8px;">Bericht</h3>
      <div style="border:1px solid #ccc;padding:10px;border-radius:6px;white-space:pre-wrap;">${esc(bericht)}</div>
    </div>
  `;

  return infomaniakTransporter.sendMail({
    from: "IJssalon Vincenzo <contact@ijssalonvincenzo.nl>",
    to: "contact@ijssalonvincenzo.nl, herman@ijssalonvincenzo.nl",
    replyTo: email,
    subject,
    text,
    html,
  });
}

export async function sendSollicitatieMail({
  voornaam,
  achternaam,
  adres,
  huisnummer,
  postcode,
  woonplaats,
  geboortedatum,
  geslacht,
  email,
  tel,
  beschikbaar_vanaf,
  beschikbaar_tot,
  bijbaan,
  voorkeur_functie,
  shifts_per_week,
  vakantie,
  momenten,
  motivatie,
}: {
  voornaam: string;
  achternaam: string;
  adres: string;
  huisnummer: string;
  postcode: string;
  woonplaats: string;
  geboortedatum: string;
  geslacht: string;
  email: string;
  tel: string;
  beschikbaar_vanaf: string;
  beschikbaar_tot: string;
  bijbaan: string;
  voorkeur_functie: string;
  shifts_per_week: string;
  vakantie: string;
  momenten: string[];
  motivatie: string;
}) {
  const naam = `${voornaam} ${achternaam}`.trim();

  const text =
    `SOLLICITATIE\n===========\n\n` +
    `Naam: ${naam}\n` +
    `E-mail: ${email}\n` +
    `Telefoon: ${tel}\n\n` +
    `Adres: ${adres}\n` +
    `Huisnummer: ${huisnummer}\n` +
    `Postcode: ${postcode}\n` +
    `Woonplaats: ${woonplaats}\n\n` +
    `Geboortedatum: ${geboortedatum}\n` +
    `Geslacht: ${geslacht}\n\n` +
    `Vanaf: ${beschikbaar_vanaf}\n` +
    `Tot: ${beschikbaar_tot}\n` +
    `Andere bijbaan: ${bijbaan}\n` +
    `Voorkeur functie: ${voorkeur_functie}\n` +
    `Shifts per week: ${shifts_per_week}\n` +
    `Vakantie: ${vakantie}\n` +
    `Beschikbare shifts: ${momenten.join(", ")}\n\n` +
    `Opmerking/Motivatie:\n${motivatie}\n`;

  const momentenHtml = momenten.length
    ? `<ul style="margin:4px 0 0 20px;padding:0;">${momenten
        .map((m) => `<li>${esc(m)}</li>`)
        .join("")}</ul>`
    : "-";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;">
      <h2 style="margin:0 0 12px 0;">SOLLICITATIE</h2>

      <h3>Gegevens</h3>
      <p><strong>Naam:</strong> ${esc(naam)}<br>
         <strong>E-mail:</strong> ${esc(email)}<br>
         <strong>Telefoon:</strong> ${esc(tel)}</p>

      <h3>Adres</h3>
      <p><strong>Adres:</strong> ${esc(adres)}<br>
         <strong>Huisnummer:</strong> ${esc(huisnummer)}<br>
         <strong>Postcode:</strong> ${esc(postcode)}<br>
         <strong>Woonplaats:</strong> ${esc(woonplaats)}</p>

      <h3>Persoonlijk</h3>
      <p><strong>Geboortedatum:</strong> ${esc(geboortedatum)}<br>
         <strong>Geslacht:</strong> ${esc(geslacht)}</p>

      <h3>Beschikbaarheid</h3>
      <p><strong>Vanaf:</strong> ${esc(beschikbaar_vanaf)}<br>
         <strong>Tot:</strong> ${esc(beschikbaar_tot)}<br>
         <strong>Andere bijbaan:</strong> ${esc(bijbaan)}<br>
         <strong>Voorkeur functie:</strong> ${esc(voorkeur_functie)}<br>
         <strong>Shifts per week:</strong> ${esc(shifts_per_week)}<br>
         <strong>Vakantie:</strong> ${esc(vakantie)}</p>

      <p><strong>Beschikbare shifts:</strong> ${momentenHtml}</p>

      <h3>Opmerking / Motivatie</h3>
      <div style="border:1px solid #ccc;padding:8px;border-radius:4px;white-space:pre-wrap;">${esc(motivatie || "-")}</div>
    </div>
  `;

  return infomaniakTransporter.sendMail({
    from: "IJssalon Vincenzo <jobs@ijssalonvincenzo.nl>",
    to: "jobs@ijssalonvincenzo.nl, herman@ijssalonvincenzo.nl",
    replyTo: email,
    subject: "Nieuwe sollicitatie via website",
    text,
    html,
  });
}