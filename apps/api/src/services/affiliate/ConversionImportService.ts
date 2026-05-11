import { prisma } from "../../db/index";

type CsvRow = Record<string, string>;

type NormalizedConversion = {
  clickIdRef: string | null;
  externalUserId: string | null;
  conversionType: string;
  conversionStatus: string;
  commissionAmount: number | null;
  currency: string | null;
  ftdAmount: number | null;
  conversionDate: Date;
};

export type ConversionImportResult = {
  imported: number;
  matched: number;
  unmatched: number;
  errors: Array<{ row: number; error: string }>;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  out.push(cell.trim());
  return out;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseDecimal(raw: string | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.replace(",", ".").replace(/[^\d.-]/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const ddmmyyyy = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const m = trimmed.match(ddmmyyyy);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function readFirst(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key.toLowerCase()];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalizeBrokerRecord(brokerSlug: string, row: CsvRow): NormalizedConversion {
  if (!brokerSlug) throw new Error("Missing broker slug");

  // Broker-specific adapters for realistic CSV exports.
  if (brokerSlug === "xtb") {
    return {
      clickIdRef: readFirst(row, ["click_id_ref", "click_id", "cid", "subid"]) || null,
      externalUserId: readFirst(row, ["external_user_id", "client_id", "user_id"]) || null,
      conversionType:
        (readFirst(row, ["conversion_type", "event_type", "event", "goal"]) || "ftd").toLowerCase(),
      conversionStatus:
        (readFirst(row, ["conversion_status", "status", "state"]) || "confirmed").toLowerCase(),
      commissionAmount: parseDecimal(
        readFirst(row, ["commission_amount", "commission_eur", "commission", "payout"]),
      ),
      currency: readFirst(row, ["commission_currency", "currency"]) || "EUR",
      ftdAmount: parseDecimal(readFirst(row, ["ftd_amount", "deposit_amount", "first_deposit"])),
      conversionDate:
        parseDate(readFirst(row, ["conversion_date", "date", "conversion_time", "created_at"])) ??
        new Date(),
    };
  }

  if (brokerSlug === "bossa") {
    return {
      clickIdRef: readFirst(row, ["click_id_ref", "cid", "click_id", "campaign_id"]) || null,
      externalUserId: readFirst(row, ["external_user_id", "user_id", "client_id"]) || null,
      conversionType:
        (readFirst(row, ["conversion_type", "goal", "type", "event"]) || "ftd").toLowerCase(),
      conversionStatus:
        (readFirst(row, ["conversion_status", "state", "status"]) || "confirmed").toLowerCase(),
      commissionAmount: parseDecimal(
        readFirst(row, ["commission_amount", "payout_pln", "commission", "amount"]),
      ),
      currency: readFirst(row, ["commission_currency", "currency"]) || "PLN",
      ftdAmount: parseDecimal(readFirst(row, ["ftd_amount", "first_deposit_pln", "deposit"])),
      conversionDate:
        parseDate(readFirst(row, ["conversion_date", "date", "created_at"])) ?? new Date(),
    };
  }

  if (brokerSlug === "etoro") {
    return {
      clickIdRef: readFirst(row, ["click_id_ref", "campaign_id", "click_id", "cid"]) || null,
      externalUserId: readFirst(row, ["external_user_id", "user_id", "client_id"]) || null,
      conversionType:
        (readFirst(row, ["conversion_type", "event", "event_name", "type"]) || "ftd").toLowerCase(),
      conversionStatus:
        (readFirst(row, ["conversion_status", "status", "state"]) || "confirmed").toLowerCase(),
      commissionAmount: parseDecimal(
        readFirst(row, ["commission_amount", "amount_usd", "commission", "payout"]),
      ),
      currency: readFirst(row, ["commission_currency", "currency"]) || "USD",
      ftdAmount: parseDecimal(readFirst(row, ["ftd_amount", "first_deposit", "deposit"])),
      conversionDate:
        parseDate(readFirst(row, ["conversion_date", "created_at", "date"])) ?? new Date(),
    };
  }

  if (brokerSlug === "trade_republic") {
    return {
      clickIdRef: readFirst(row, ["click_id_ref", "clickid", "click_id", "cid"]) || null,
      externalUserId: readFirst(row, ["external_user_id", "customer_ref", "user_id"]) || null,
      conversionType:
        (readFirst(row, ["conversion_type", "type", "event"]) || "ftd").toLowerCase(),
      conversionStatus:
        (readFirst(row, ["conversion_status", "status", "state"]) || "confirmed").toLowerCase(),
      commissionAmount: parseDecimal(
        readFirst(row, ["commission_amount", "commission", "amount", "payout"]),
      ),
      currency: readFirst(row, ["commission_currency", "currency"]) || "EUR",
      ftdAmount: parseDecimal(readFirst(row, ["ftd_amount", "first_deposit", "deposit"])),
      conversionDate: parseDate(readFirst(row, ["conversion_date", "date", "created_at"])) ?? new Date(),
    };
  }

  // Generic fallback parser.
  const clickIdRef = readFirst(row, ["click_id_ref", "click_id", "cid", "clickid", "campaign_id"]) || null;
  const externalUserId = readFirst(row, ["external_user_id", "user_id", "client_id"]) || null;
  const conversionType = readFirst(row, ["conversion_type", "type", "event", "goal"]) || "ftd";
  const conversionStatus = readFirst(row, ["conversion_status", "status", "state"]) || "confirmed";
  const commissionAmount = parseDecimal(readFirst(row, ["commission_amount", "commission", "payout", "amount"]));
  const currency = readFirst(row, ["commission_currency", "currency"]) || "EUR";
  const ftdAmount = parseDecimal(readFirst(row, ["ftd_amount", "deposit", "first_deposit"]));
  const conversionDate = parseDate(readFirst(row, ["conversion_date", "date", "created_at"])) ?? new Date();

  return {
    clickIdRef,
    externalUserId,
    conversionType: conversionType.toLowerCase(),
    conversionStatus: conversionStatus.toLowerCase(),
    commissionAmount,
    currency,
    ftdAmount,
    conversionDate,
  };
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.max(0, b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export class ConversionImportService {
  async importFromCSV(brokerSlug: string, csvContent: string): Promise<ConversionImportResult> {
    const broker = await prisma.affiliateBroker.findUnique({
      where: { slug: brokerSlug.trim().toLowerCase() },
    });
    if (!broker) throw new Error(`Unknown broker: ${brokerSlug}`);

    const records = parseCsv(csvContent);
    const result: ConversionImportResult = {
      imported: 0,
      matched: 0,
      unmatched: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i += 1) {
      const row = records[i];
      try {
        const normalized = normalizeBrokerRecord(broker.slug, row);
        const matchedClick = normalized.clickIdRef
          ? await prisma.affiliateClick.findUnique({ where: { clickId: normalized.clickIdRef } })
          : null;

        await prisma.affiliateConversion.create({
          data: {
            clickIdRef: normalized.clickIdRef,
            brokerId: broker.id,
            userId: matchedClick?.userId ?? null,
            externalUserId: normalized.externalUserId,
            conversionType: normalized.conversionType,
            conversionStatus: normalized.conversionStatus,
            commissionAmount: normalized.commissionAmount,
            commissionCurrency: normalized.currency,
            ftdAmount: normalized.ftdAmount,
            attributionWindowDays: matchedClick
              ? daysBetween(matchedClick.clickedAt, normalized.conversionDate)
              : null,
            matchedClickId: matchedClick?.id ?? null,
            conversionDate: normalized.conversionDate,
            rawBrokerData: row,
          },
        });

        result.imported += 1;
        if (matchedClick) result.matched += 1;
        else result.unmatched += 1;
      } catch (error) {
        result.errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : "Unknown import error",
        });
      }
    }

    return result;
  }
}
