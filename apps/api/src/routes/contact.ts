import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

type ContactRouteDeps = {
  fetchImpl: typeof fetch;
  resendApiKey: string | null;
};

type ContactPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

function normalizeRequiredField(input: unknown): string {
  return String(input ?? "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toContactPayload(input: Record<string, unknown>): ContactPayload | null {
  const name = normalizeRequiredField(input.name);
  const email = normalizeRequiredField(input.email);
  const subject = normalizeRequiredField(input.subject);
  const message = normalizeRequiredField(input.message);

  if (!name || !email || !subject || !message) return null;

  return { name, email, subject, message };
}

function contactEmailHtml(payload: ContactPayload): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px 0;color:#2D0A6B;">Nowa wiadomość kontaktowa — StockAI Pro</h2>
      <p><strong>Imię i nazwisko:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Temat:</strong> ${escapeHtml(payload.subject)}</p>
      <p><strong>Wiadomość:</strong></p>
      <p style="white-space:pre-wrap;border:1px solid #E5E7EB;padding:12px;border-radius:8px;">${escapeHtml(payload.message)}</p>
    </div>
  `;
}

async function sendContactEmail(deps: ContactRouteDeps, payload: ContactPayload): Promise<void> {
  const apiKey = deps.resendApiKey;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const response = await deps.fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "hello@stock-ai.pro",
      to: ["marcin.chledzik@amcenergy.pl"],
      subject: `[StockAI Pro Contact] ${payload.subject}`,
      html: contactEmailHtml(payload),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

export function createContactRouter(inputDeps?: Partial<ContactRouteDeps>): Router {
  const deps: ContactRouteDeps = {
    fetchImpl: inputDeps?.fetchImpl ?? fetch,
    resendApiKey: inputDeps?.resendApiKey ?? process.env.RESEND_API_KEY?.trim() ?? null,
  };

  const router = Router();

  router.post("/api/contact", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const payload = toContactPayload(body);
      if (!payload) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      await sendContactEmail(deps, payload);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
