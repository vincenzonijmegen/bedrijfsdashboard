import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendUitnodiging(email: string, naam: string, wachtwoord: string) {
  console.log("📧 Verstuur uitnodiging naar:", email, "met wachtwoord:", wachtwoord);
  const subject = "Je werkinstructie-account bij IJssalon Vincenzo";
  const body = `
    <p>Hallo ${naam},</p>
    <p>Je bent toegevoegd aan het werkinstructiesysteem van IJssalon Vincenzo.</p>
    <p><strong>Loginpagina:</strong> <a href="https://werkinstructies.vincenzo.nl/sign-in">klik hier om in te loggen</a></p>
    <p><strong>Tijdelijk wachtwoord:</strong> ${wachtwoord}</p>
    <p>Wijzig dit wachtwoord na je eerste login.</p>
    <p>Met vriendelijke groet,<br/>IJssalon Vincenzo</p>
  `;

  const result = await resend.emails.send({
    from: "IJssalon Vincenzo <noreply@mail.vincenzo.nl>",
    to: email,
    subject,
    html: body,
  });

  console.log("📬 Resend response:", result);
}
