export async function sendUitnodiging(email: string, naam: string, wachtwoord: string) {
  const subject = "Uitnodiging: Werkinstructies Vincenzo";
  const body = `
    Hallo ${naam},

    Je bent toegevoegd aan het werkinstructiesysteem van IJssalon Vincenzo.

    Je kunt inloggen via: https://werkinstructies.vincenzo.nl/inloggen  
    Tijdelijk wachtwoord: ${wachtwoord}

    Wijzig je wachtwoord na de eerste login.

    Met vriendelijke groet,  
    IJssalon Vincenzo
  `;

  // Bijv. via Resend, Mailgun, of Nodemailer
  await sendMail({ to: email, subject, body });
}
