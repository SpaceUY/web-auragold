// Vercel Function (convención de carpeta /api en la raíz, independiente del
// output estático de Astro). Recibe el formulario de soporte de
// /politicas-de-privacidad y lo reenvía por email vía la API de Brevo.
//
// Requiere la variable de entorno BREVO_API_KEY configurada en Vercel
// (Project Settings → Environment Variables). Nunca hardcodear la API key.

const CATEGORIES = [
  "Eliminación de cuenta",
  "Mis datos personales / privacidad",
  "Problema con una transacción u orden",
  "Problema técnico con la app",
  "Otros",
];

const SUPPORT_EMAIL = "info@mintia.tech";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const { name, email, category, message, website } = body;

  // Honeypot anti-spam: un campo oculto que solo un bot completaría.
  // Respondemos 200 sin enviar nada, para no delatar el filtro.
  if (website) {
    res.status(200).json({ ok: true });
    return;
  }

  const isValid =
    typeof name === "string" &&
    name.trim().length >= 2 &&
    name.length <= 100 &&
    typeof email === "string" &&
    email.length <= 200 &&
    EMAIL_RE.test(email) &&
    typeof category === "string" &&
    CATEGORIES.includes(category) &&
    typeof message === "string" &&
    message.trim().length >= 10 &&
    message.length <= 5000;

  if (!isValid) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY no configurada");
    res.status(500).json({ error: "No se pudo enviar el mensaje" });
    return;
  }

  try {
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Formulario de soporte AuraGold", email: SUPPORT_EMAIL },
        to: [{ email: SUPPORT_EMAIL, name: "Soporte AuraGold" }],
        replyTo: { email, name },
        subject: `[Soporte Aura] ${category} - ${name}`,
        htmlContent: `
          <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Categoría:</strong> ${escapeHtml(category)}</p>
          <p><strong>Mensaje:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error("Brevo API error:", brevoRes.status, errText);
      res.status(502).json({ error: "No se pudo enviar el mensaje" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error enviando a Brevo:", err);
    res.status(500).json({ error: "No se pudo enviar el mensaje" });
  }
}
