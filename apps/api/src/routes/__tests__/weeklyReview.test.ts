import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createWeeklyReviewRouter } from "../weeklyReview";

describe("weekly review routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createWeeklyReviewRouter({
        getCurrentFn: async () => ({
          id: "wr-1",
          userId: "demo-user",
          weekStart: "2026-05-11T00:00:00.000Z",
          answers: { q1: 4, q2: 2, q3: 5, q4: "Patience", q5: "Fewer trades" },
          aiLetter: "You stayed disciplined and can sharpen selectivity next week.",
          growthScore: 80,
          createdAt: "2026-05-13T18:00:00.000Z",
        }),
        createFn: async ({ userId, q1, q2, q3, q4, q5 }) => ({
          review: {
            id: "wr-2",
            userId,
            weekStart: "2026-05-11T00:00:00.000Z",
            answers: {
              q1: Number(q1),
              q2: Number(q2),
              q3: Number(q3),
              q4: String(q4),
              q5: String(q5),
            },
            aiLetter: "You are improving consistency and should keep your risk boundaries tighter.",
            growthScore: 73,
            createdAt: "2026-05-13T18:10:00.000Z",
          },
          letter: "You are improving consistency and should keep your risk boundaries tighter.",
        }),
        getHistoryFn: async () => ({
          reviews: [
            {
              id: "wr-h1",
              userId: "demo-user",
              weekStart: "2026-05-11T00:00:00.000Z",
              answers: { q1: 4, q2: 2, q3: 5, q4: "Patience", q5: "Fewer trades" },
              aiLetter: "Strong week with better discipline.",
              growthScore: 80,
              createdAt: "2026-05-13T18:00:00.000Z",
            },
          ],
        }),
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("GET /api/weekly/current/:userId returns review payload", async () => {
    const res = await fetch(`${baseUrl}/api/weekly/current/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { hasReview: boolean; review: { id: string } };
    assert.equal(body.hasReview, true);
    assert.equal(body.review.id, "wr-1");
  });

  it("POST /api/weekly returns saved review and letter", async () => {
    const res = await fetch(`${baseUrl}/api/weekly`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        q1: 5,
        q2: 2,
        q3: 4,
        q4: "Waited for setups",
        q5: "Journal every trade",
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { letter: string; review: { answers: { q1: number } } };
    assert.ok(body.letter.length > 0);
    assert.equal(body.review.answers.q1, 5);
  });

  it("GET /api/weekly/history/:userId returns reviews", async () => {
    const res = await fetch(`${baseUrl}/api/weekly/history/demo-user?weeks=8`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { reviews: Array<{ id: string }> };
    assert.equal(body.reviews.length, 1);
    assert.equal(body.reviews[0]?.id, "wr-h1");
  });
});
