import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type CompanyLogoRow } from "./companyLogoBackfill";
import {
  auditCompanyLogoRow,
  auditCompanyLogoRows,
  formatCompanyLogoAuditJson,
  isFinnhubLogoUrl,
} from "./companyLogoAudit";

function row(partial: CompanyLogoRow): CompanyLogoRow {
  return partial;
}

describe("auditCompanyLogoRow", () => {
  it("detects MRK.XETRA with US EODHD path as suspicious", () => {
    const entry = auditCompanyLogoRow(
      row({
        symbol: "MRK.XETRA",
        name: "Merck KGaA",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
      }),
    );
    assert.equal(entry.classification, "suspicious");
    assert.equal(entry.urlExchange, "US");
    assert.equal(entry.suggestedAction, "clear");
  });

  it("allows exact XETRA EODHD path for SIE.XETRA", () => {
    const entry = auditCompanyLogoRow(
      row({
        symbol: "SIE.XETRA",
        name: "Siemens AG",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/XETRA/SIE.png",
      }),
    );
    assert.equal(entry.classification, "ok");
    assert.equal(entry.suggestedAction, "keep");
  });

  it("allows DAX listing with XETRA EODHD path (DAX-XETRA equivalence)", () => {
    const entry = auditCompanyLogoRow(
      row({
        symbol: "ALV",
        name: "Allianz SE",
        exchange: "DAX",
        logoUrl: "https://eodhd.com/img/logos/XETRA/ALV.png",
      }),
    );
    assert.equal(entry.classification, "ok");
    assert.equal(entry.urlExchange, "XETRA");
  });

  it("allows BAS.XETRA with XETRA path", () => {
    const entry = auditCompanyLogoRow(
      row({
        symbol: "BAS.XETRA",
        name: "BASF SE",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/XETRA/BAS.png",
      }),
    );
    assert.equal(entry.classification, "ok");
  });

  it("treats Finnhub static2 URL as neutral externalProvider", () => {
    const url =
      "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png";
    assert.equal(isFinnhubLogoUrl(url), true);
    const entry = auditCompanyLogoRow(
      row({ symbol: "AAPL", name: "Apple Inc", exchange: "US", logoUrl: url }),
    );
    assert.equal(entry.classification, "externalProvider");
    assert.equal(entry.urlExchange, null);
    assert.equal(entry.suggestedAction, "keep");
  });

  it("does not flag SHEL.LSE with matching LSE EODHD path as suspicious", () => {
    const entry = auditCompanyLogoRow(
      row({
        symbol: "SHEL.LSE",
        name: "Shell PLC",
        exchange: "LSE",
        logoUrl: "https://eodhd.com/img/logos/LSE/SHEL.png",
      }),
    );
    assert.equal(entry.classification, "ok");
  });
});

describe("auditCompanyLogoRows", () => {
  it("filters only suspicious entries", () => {
    const result = auditCompanyLogoRows(
      [
        row({
          symbol: "MRK.XETRA",
          name: "Merck KGaA",
          exchange: "XETRA",
          logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
        }),
        row({
          symbol: "SIE.XETRA",
          name: "Siemens AG",
          exchange: "XETRA",
          logoUrl: "https://eodhd.com/img/logos/XETRA/SIE.png",
        }),
      ],
      { onlySuspicious: true },
    );
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.symbol, "MRK.XETRA");
    assert.equal(result.summary.suspicious, 1);
  });
});

describe("formatCompanyLogoAuditJson", () => {
  it("outputs JSON without secrets", () => {
    const json = formatCompanyLogoAuditJson(
      auditCompanyLogoRows([
        row({
          symbol: "MRK.XETRA",
          name: "Merck KGaA",
          exchange: "XETRA",
          logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
        }),
      ]),
    );
    assert.doesNotMatch(json, /api_token|secret|password/i);
    const parsed = JSON.parse(json) as { entries: { classification: string }[] };
    assert.equal(parsed.entries[0]?.classification, "suspicious");
  });
});
