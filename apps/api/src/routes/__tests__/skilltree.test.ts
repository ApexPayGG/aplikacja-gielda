import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createSkillTreeRouter } from "../skilltree";

describe("skilltree routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createSkillTreeRouter({
        getSkillTreeFn: async () => ({
          skills: [
            {
              id: "BASICS",
              name: "Basics",
              description: "Rozumiesz akcje i giełdę",
              unlockCondition: "Zawsze odblokowane",
              unlocked: true,
              unlockedAt: "2026-05-10T10:00:00.000Z",
            },
          ],
          totalUnlocked: 1,
          totalSkills: 10,
        }),
        checkProgressFn: async () => ({ newlyUnlocked: ["RSI"] }),
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

  it("GET /api/skilltree/:userId returns skill tree payload", async () => {
    const res = await fetch(`${baseUrl}/api/skilltree/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { totalUnlocked: number; totalSkills: number };
    assert.equal(body.totalUnlocked, 1);
    assert.equal(body.totalSkills, 10);
  });

  it("POST /api/skilltree/:userId/check returns newly unlocked skills", async () => {
    const res = await fetch(`${baseUrl}/api/skilltree/demo-user/check`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { newlyUnlocked: string[] };
    assert.deepEqual(body.newlyUnlocked, ["RSI"]);
  });

  it("validates missing userId", async () => {
    const getRes = await fetch(`${baseUrl}/api/skilltree/%20`);
    assert.equal(getRes.status, 400);

    const postRes = await fetch(`${baseUrl}/api/skilltree/%20/check`, { method: "POST" });
    assert.equal(postRes.status, 400);
  });
});
