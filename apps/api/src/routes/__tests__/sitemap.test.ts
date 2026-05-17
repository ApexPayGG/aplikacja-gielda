import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createSitemapRouter } from "../sitemap";

type TestCompany = {
  symbol: string;
  createdAt: Date;
};

describe("sitemap routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    const companies: TestCompany[] = [
      { symbol: "AAPL", createdAt: new Date("2025-01-02T12:00:00.000Z") },
      { symbol: "MSFT", createdAt: new Date("2025-02-03T15:30:00.000Z") },
    ];
    let cachedXml: string | null = null;

    app.use(
      createSitemapRouter({
        baseUrl: "https://stock-ai.pro",
        staticPages: ["/", "/pricing"],
        getCompanies: async () => companies,
        cacheGet: async () => cachedXml,
        cacheSet: async (_key, value) => {
          cachedXml = value;
        },
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
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

  it("GET /sitemap.xml returns sitemap XML with static and dynamic urls", async () => {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/xml; charset=utf-8");
    const body = await res.text();
    assert.match(body, /<urlset[\s\S]*<\/urlset>/);
    assert.match(body, /<loc>https:\/\/stock-ai\.pro\/<\/loc>/);
    assert.match(body, /<loc>https:\/\/stock-ai\.pro\/pricing<\/loc>/);
    assert.match(body, /<loc>https:\/\/stock-ai\.pro\/company\/AAPL<\/loc>/);
    assert.match(body, /<loc>https:\/\/stock-ai\.pro\/company\/MSFT<\/loc>/);
    assert.match(body, /<changefreq>weekly<\/changefreq>/);
    assert.match(body, /<priority>0\.8<\/priority>/);
    assert.match(body, /<changefreq>daily<\/changefreq>/);
    assert.match(body, /<priority>0\.6<\/priority>/);
    assert.match(body, /<lastmod>2025-01-02T12:00:00\.000Z<\/lastmod>/);
  });

  it("GET /sitemap.xml uses cached value when available", async () => {
    const first = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(first.status, 200);
    const firstBody = await first.text();
    assert.match(firstBody, /AAPL/);

    const second = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(second.status, 200);
    const secondBody = await second.text();
    assert.equal(secondBody, firstBody);
  });

  it("GET /robots.txt returns expected directives", async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
    const body = await res.text();
    assert.equal(
      body,
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /api",
        "Disallow: /dashboard",
        "Disallow: /settings",
        "Sitemap: https://stock-ai.pro/sitemap.xml",
      ].join("\n"),
    );
  });
});
