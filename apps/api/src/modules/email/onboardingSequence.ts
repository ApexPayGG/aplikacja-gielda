import type { Queue, Worker } from "bullmq";
import { Queue as BullQueue, Worker as BullWorker } from "bullmq";
import type { Redis } from "ioredis";
import process from "node:process";
import { prisma } from "../../db/index";
import { generateOnboardingBehavioralCoachEmail } from "../../templates/onboardingBehavioralCoachEmail";
import { generateOnboardingWeekOneEmail } from "../../templates/onboardingWeekOneEmail";

const ONBOARDING_SEQUENCE_QUEUE_NAME = "onboarding-email-sequence";
const ONBOARDING_SEQUENCE_JOB_NAME = "onboarding:sequence";
const DAY_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_EMAIL_1_SUBJECT = "Witaj w StockAI Pro — zacznij od tego";
export const ONBOARDING_EMAIL_2_SUBJECT = "Czy wiesz że StockAI Pro ma Behavioral Coach?";
export const ONBOARDING_EMAIL_3_SUBJECT = "Twoje pierwsze 7 dni — co dalej?";

type OnboardingUserRow = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
};

type OnboardingDeps = {
  db: typeof prisma;
  fetchImpl: typeof fetch;
  now: () => Date;
  resendApiKey: string | null;
};

const defaultDeps: OnboardingDeps = {
  db: prisma,
  fetchImpl: fetch,
  now: () => new Date(),
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? null,
};

export type OnboardingSequenceResult = {
  email2Sent: number;
  email3Sent: number;
  failed: number;
};

function withDeps(depsInput?: Partial<OnboardingDeps>): OnboardingDeps {
  return {
    db: depsInput?.db ?? defaultDeps.db,
    fetchImpl: depsInput?.fetchImpl ?? defaultDeps.fetchImpl,
    now: depsInput?.now ?? defaultDeps.now,
    resendApiKey: depsInput?.resendApiKey ?? defaultDeps.resendApiKey,
  };
}

async function sendResendEmail(
  deps: OnboardingDeps,
  input: { to: string; subject: string; text: string; html: string },
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
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

async function findEmail2Candidates(deps: OnboardingDeps, now: Date): Promise<OnboardingUserRow[]> {
  const twoDaysAgo = new Date(now.getTime() - 2 * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  return deps.db.$queryRaw<OnboardingUserRow[]>`
    SELECT id, email, name, tier
    FROM users
    WHERE email_verified = true
      AND onboarding_email2_sent = false
      AND onboarding_email3_sent = false
      AND last_login_at IS NULL
      AND created_at <= ${twoDaysAgo}
      AND created_at > ${sevenDaysAgo}
  `;
}

async function findEmail3Candidates(deps: OnboardingDeps, now: Date): Promise<OnboardingUserRow[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  return deps.db.$queryRaw<OnboardingUserRow[]>`
    SELECT id, email, name, tier
    FROM users
    WHERE email_verified = true
      AND onboarding_email3_sent = false
      AND created_at <= ${sevenDaysAgo}
  `;
}

export async function sendOnboardingSequence(depsInput?: Partial<OnboardingDeps>): Promise<OnboardingSequenceResult> {
  const deps = withDeps(depsInput);
  const now = deps.now();
  const result: OnboardingSequenceResult = { email2Sent: 0, email3Sent: 0, failed: 0 };

  const email2Candidates = await findEmail2Candidates(deps, now);
  for (const user of email2Candidates) {
    try {
      await sendResendEmail(deps, {
        to: user.email,
        subject: ONBOARDING_EMAIL_2_SUBJECT,
        text: "Behavioral Coach pomaga wyłapać nawyki tradingowe i poprawić decyzje. Wypróbuj: https://stock-ai.pro/app/behavioral",
        html: generateOnboardingBehavioralCoachEmail(user.name),
      });
      await deps.db.$executeRaw`
        UPDATE users
        SET onboarding_email2_sent = true
        WHERE id = ${user.id}
      `;
      result.email2Sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`[onboarding] email2 failed for user ${user.id}:`, error);
    }
  }

  const email3Candidates = await findEmail3Candidates(deps, now);
  for (const user of email3Candidates) {
    try {
      await sendResendEmail(deps, {
        to: user.email,
        subject: ONBOARDING_EMAIL_3_SUBJECT,
        text: "Podsumuj pierwszy tydzień i sprawdź kolejne kroki w StockAI Pro: https://stock-ai.pro/app/dashboard",
        html: generateOnboardingWeekOneEmail({ name: user.name, tier: user.tier }),
      });
      await deps.db.$executeRaw`
        UPDATE users
        SET onboarding_email2_sent = true,
            onboarding_email3_sent = true
        WHERE id = ${user.id}
      `;
      result.email3Sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`[onboarding] email3 failed for user ${user.id}:`, error);
    }
  }

  return result;
}

export function registerOnboardingSequenceJob(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new BullQueue(ONBOARDING_SEQUENCE_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
    },
  });

  const worker = new BullWorker(
    ONBOARDING_SEQUENCE_QUEUE_NAME,
    async (job) => {
      if (job.name !== ONBOARDING_SEQUENCE_JOB_NAME) return;
      const summary = await sendOnboardingSequence();
      console.log(
        `[onboarding] sendOnboardingSequence done email2=${summary.email2Sent} email3=${summary.email3Sent} failed=${summary.failed}`,
      );
      return summary;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[onboarding] job ${job?.id} failed`, err);
  });

  return { queue, worker };
}

export async function scheduleOnboardingSequenceJob(queue: Pick<Queue, "add">): Promise<void> {
  await queue.add(
    ONBOARDING_SEQUENCE_JOB_NAME,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "onboarding-sequence-hourly",
    },
  );
}
