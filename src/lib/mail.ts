import { Resend } from "resend";

export async function sendUitnodiging(email: string, naam: string, wachtwoord: string) {
  console.log("📧 Verstuur uitnodiging naar:", email, "met wachtwoord:", wachtwoord);

  const subject = "Je werkinstructie-account bij IJssalon Vincenzo";
  const body = `
    <p>Hallo ${naam},</p>
    <p>Je bent toegevoegd aan het werkinstructiesysteem van IJssalon Vincenzo.</p>
    <p><strong>Loginpagina:</strong> <a href="https://werkinstructies-app.vercel.app/sign-in">klik hier om in te loggen</a></p>
    <p><strong>Tijdelijk wachtwoord:</strong> ${wachtwoord}</p>
    <p>Wijzig dit wachtwoord na je eerste login.</p>
    <p>Met vriendelijke groet,<br/>Erik en Hermano</p>
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
