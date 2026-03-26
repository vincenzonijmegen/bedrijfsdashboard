// app/api/mail/bestelling/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tekstNaarHtml(tekst: string) {
  const escaped = escapeHtml(tekst);
  const lines = escaped.split("\n");

  const title = lines[0] || "Bestelling IJssalon Vincenzo";
  const referentieLine = lines.find((line) => line.startsWith("Referentie:")) || "";
  const opmerkingIndex = lines.findIndex((line) => line.startsWith("Opmerkingen:"));

  const dataStartIndex = lines.findIndex((line) => line.startsWith("------"));
  const productLines =
    dataStartIndex >= 0
      ? lines.slice(dataStartIndex + 1, opmerkingIndex >= 0 ? opmerkingIndex : undefined)
      : [];

  const rows = productLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [aantal = "", bestelnummer = "", ...rest] = line.split("\t");
      return {
        aantal,
        bestelnummer,
        naam: rest.join("\t"),
      };
    });

  const opmerking =
    opmerkingIndex >= 0
      ? lines.slice(opmerkingIndex).join("\n").replace(/^Opmerkingen:\s*/, "")
      : "";

  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${row.aantal}</td>
          <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${row.bestelnummer}</td>
          <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${row.naam}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif; color:#111827; line-height:1.5;">
      <h2 style="margin:0 0 12px;">${title}</h2>
      ${referentieLine ? `<p style="margin:0 0 16px;"><strong>${referentieLine}</strong></p>` : ""}
      <p style="margin:0 0 12px;">Beste,</p>
      <p style="margin:0 0 16px;">Hierbij onze bestelling.</p>

      <table style="border-collapse:collapse; width:100%; max-width:900px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:8px; border-bottom:2px solid #111827;">Aantal</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid #111827;">Bestelnummer</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid #111827;">Product</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${
        opmerking
          ? `
            <p style="margin:20px 0 6px;"><strong>Opmerkingen</strong></p>
            <p style="margin:0; white-space:pre-wrap;">${opmerking}</p>
          `
          : ""
      }

      <p style="margin:24px 0 0;">Met vriendelijke groet,<br><strong>IJssalon Vincenzo</strong></p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { naar, onderwerp, tekst } = await req.json();

    if (!naar || !onderwerp || !tekst) {
      return NextResponse.json({ error: "Ontbrekende gegevens" }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY ontbreekt" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const html = tekstNaarHtml(String(tekst));

    const result = await resend.emails.send({
      from: "IJssalon Vincenzo <bestelling@send.ijssalonvincenzo.nl>",
      to: Array.isArray(naar) ? naar : [naar],
      replyTo: "herman@ijssalonvincenzo.nl",
      subject: String(onderwerp),
      text: String(tekst),
      html,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("❌ Mailfout bij /api/mail/bestelling:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}