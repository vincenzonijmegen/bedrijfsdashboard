import nodemailer from "nodemailer";

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