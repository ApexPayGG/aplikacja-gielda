import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

const WAITLIST_CONFIRMATION_SUBJECT = "Jesteś na liście! StockAI Pro Early Access";
const WAITLIST_SOURCES = new Set(["landing", "pricing", "signal"]);

type WaitlistRouteDeps = {
  db: {
    waitlistEntry: {
      findUnique: (args: { where: { email: string } }) => Promise<{ id: string } | null>;
      create: (args: {
        data: { email: string; name: string | null; source: string | null };
      }) => Promise<{ id: string }>;
      count: () => Promise<number>;
      findMany: (args: {
        orderBy: { createdAt: "desc" };
        select: {
          id: true;
          email: true;
          name: true;
          source: true;
          createdAt: true;
        };
      }) => Promise<
        Array<{
          id: string;
          email: string;
          name: string | null;
          source: string | null;
          createdAt: Date;
        }>
      >;
    };
    user: {
      findUnique: (args: {
        where: { id: string };
        select: { role: true };
      }) => Promise<{ role: string } | null>;
    };
  };
  fetchImpl: typeof fetch;
  resendApiKey: string | null;
  requireAuthMiddleware: (req: Request, res: Response, next: NextFunction) => void;
};

function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeName(input: unknown): string | null {
  const normalized = String(input ?? "").trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeSource(input: unknown): string | null {
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return WAITLIST_SOURCES.has(normalized) ? normalized : null;
}

function waitlistConfirmationText(name: string | null): string {
  const greeting = name ? `Cześć ${name},` : "Cześć,";
  return `${greeting}\n\nDziękujemy za zapis do StockAI Pro Early Access. Jesteś oficjalnie na liście oczekujących.\n\nDam znać, gdy uruchomimy dostęp.\n\nZespół StockAI Pro`;
}

function waitlistConfirmationHtml(name: string | null): string {
  const greeting = name ? `Cześć ${name},` : "Cześć,";
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
      <p>${greeting}</p>
      <p>Dziękujemy za zapis do <strong>StockAI Pro Early Access</strong>. Jesteś oficjalnie na liście oczekujących.</p>
      <p>Dam znać, gdy uruchomimy dostęp.</p>
      <p>Pozdrawiamy,<br/>Zespół StockAI Pro</p>
    </div>
  `;
}

async function sendWaitlistConfirmationEmail(
  deps: WaitlistRouteDeps,
  input: { email: string; name: string | null },
): Promise<void> {
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
      to: [input.email],
      subject: WAITLIST_CONFIRMATION_SUBJECT,
      text: waitlistConfirmationText(input.name),
      html: waitlistConfirmationHtml(input.name),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

export function createWaitlistRouter(inputDeps?: Partial<WaitlistRouteDeps>): Router {
  const deps: WaitlistRouteDeps = {
    db: inputDeps?.db ?? prisma,
    fetchImpl: inputDeps?.fetchImpl ?? fetch,
    resendApiKey: inputDeps?.resendApiKey ?? process.env.RESEND_API_KEY?.trim() ?? null,
    requireAuthMiddleware: inputDeps?.requireAuthMiddleware ?? requireAuth,
  };

  const router = Router();

  router.post("/api/waitlist", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const email = normalizeEmail(body.email);
      const name = normalizeName(body.name);
      const source = normalizeSource(body.source);

      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Invalid email" });
        return;
      }
      if (body.source !== undefined && source === null) {
        res.status(400).json({ error: "Invalid source. Allowed values: landing, pricing, signal" });
        return;
      }

      const existing = await deps.db.waitlistEntry.findUnique({
        where: { email },
      });
      if (existing) {
        const count = await deps.db.waitlistEntry.count();
        res.status(200).json({ ok: true, alreadyJoined: true, count });
        return;
      }

      await deps.db.waitlistEntry.create({
        data: { email, name, source },
      });
      await sendWaitlistConfirmationEmail(deps, { email, name });
      const count = await deps.db.waitlistEntry.count();

      res.status(201).json({
        ok: true,
        alreadyJoined: false,
        count,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/waitlist", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await deps.db.waitlistEntry.count();
      res.json({ count });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/admin/waitlist",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        const user = await deps.db.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (!user || user.role !== "ADMIN") {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const [count, entries] = await Promise.all([
          deps.db.waitlistEntry.count(),
          deps.db.waitlistEntry.findMany({
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              email: true,
              name: true,
              source: true,
              createdAt: true,
            },
          }),
        ]);
        res.json({ count, entries });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
