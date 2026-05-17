import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleOnboardingSequenceJob, sendOnboardingSequence } from "../onboardingSequence";

function toSqlString(chunk: unknown): string {
  if (Array.isArray(chunk)) {
    return chunk.join(" ");
  }
  return String(chunk ?? "");
}

describe("onboarding sequence", () => {
  it("sends email 2 and email 3 to eligible users and marks flags", async () => {
    const sentPayloads: Array<Record<string, unknown>> = [];
    const updatedSql: string[] = [];
    let queryCall = 0;

    const result = await sendOnboardingSequence({
      now: () => new Date("2026-05-17T19:00:00.000Z"),
      resendApiKey: "test-key",
      fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => {
        sentPayloads.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return {
          ok: true,
          status: 200,
          text: async () => "",
        } as Response;
      },
      db: {
        $queryRaw: async () => {
          queryCall += 1;
          if (queryCall === 1) {
            return [
              { id: "u-email2", email: "inactive@example.com", name: "Jan", tier: "FREE" },
            ];
          }
          return [
            { id: "u-email3", email: "week@example.com", name: "Ala", tier: "FREE" },
          ];
        },
        $executeRaw: async (chunk: unknown) => {
          updatedSql.push(toSqlString(chunk));
          return 1;
        },
      } as never,
    });

    assert.equal(result.email2Sent, 1);
    assert.equal(result.email3Sent, 1);
    assert.equal(sentPayloads.length, 2);
    assert.equal(sentPayloads[0]?.from, "hello@stock-ai.pro");
    assert.equal(sentPayloads[1]?.from, "hello@stock-ai.pro");
    assert.match(String(sentPayloads[0]?.subject), /Behavioral Coach/);
    assert.match(String(sentPayloads[1]?.subject), /pierwsze 7 dni/);
    assert.equal(updatedSql.length, 2);
    assert.match(updatedSql[0] ?? "", /onboarding_email2_sent/);
    assert.match(updatedSql[1] ?? "", /onboarding_email3_sent/);
  });

  it("registers hourly repeat in scheduler", async () => {
    const added: Array<{ name: string; data: unknown; opts?: Record<string, unknown> }> = [];
    await scheduleOnboardingSequenceJob({
      add: async (name: string, data: unknown, opts?: Record<string, unknown>) => {
        added.push({ name, data, opts });
        return {} as never;
      },
    } as never);

    assert.equal(added.length, 1);
    assert.equal(added[0]?.opts?.repeat && (added[0]?.opts?.repeat as { every: number }).every, 60 * 60 * 1000);
  });
});
