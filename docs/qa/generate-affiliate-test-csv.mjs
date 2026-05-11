import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "test_data");

function toCsv(headers, rows) {
  const esc = (value) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

const datasets = [
  {
    filename: "xtb_test.csv",
    headers: [
      "conversion_time",
      "client_id",
      "event_type",
      "status",
      "commission_eur",
      "currency",
      "deposit_amount",
      "click_id_ref",
    ],
    rows: [
      {
        conversion_time: "2026-05-11T10:15:00Z",
        client_id: "XTB_USR_001",
        event_type: "signup",
        status: "confirmed",
        commission_eur: "100.00",
        currency: "EUR",
        deposit_amount: "500.00",
        click_id_ref: "abc123def456",
      },
      {
        conversion_time: "2026-05-10T18:30:00Z",
        client_id: "XTB_USR_002",
        event_type: "ftd",
        status: "confirmed",
        commission_eur: "150.00",
        currency: "EUR",
        deposit_amount: "1000.00",
        click_id_ref: "xyz789ghi012",
      },
      {
        conversion_time: "2026-05-09T09:00:00Z",
        client_id: "XTB_USR_003",
        event_type: "signup",
        status: "confirmed",
        commission_eur: "80.00",
        currency: "EUR",
        deposit_amount: "250.00",
        click_id_ref: "",
      },
    ],
  },
  {
    filename: "bossa_test.csv",
    headers: [
      "date",
      "user_id",
      "goal",
      "state",
      "payout_pln",
      "currency",
      "first_deposit_pln",
      "cid",
    ],
    rows: [
      {
        date: "11.05.2026",
        user_id: "BOSSA_USR_001",
        goal: "signup",
        state: "confirmed",
        payout_pln: "100.00",
        currency: "PLN",
        first_deposit_pln: "500.00",
        cid: "abc123def456",
      },
      {
        date: "10.05.2026",
        user_id: "BOSSA_USR_002",
        goal: "ftd",
        state: "confirmed",
        payout_pln: "150.00",
        currency: "PLN",
        first_deposit_pln: "1000.00",
        cid: "xyz789ghi012",
      },
      {
        date: "09.05.2026",
        user_id: "BOSSA_USR_003",
        goal: "signup",
        state: "confirmed",
        payout_pln: "80.00",
        currency: "PLN",
        first_deposit_pln: "250.00",
        cid: "",
      },
    ],
  },
  {
    filename: "etoro_test.csv",
    headers: [
      "created_at",
      "external_user_id",
      "event_name",
      "status",
      "amount_usd",
      "currency",
      "first_deposit",
      "campaign_id",
    ],
    rows: [
      {
        created_at: "2026-05-11T11:45:00Z",
        external_user_id: "ETORO_USR_001",
        event_name: "signup",
        status: "confirmed",
        amount_usd: "100.00",
        currency: "USD",
        first_deposit: "500.00",
        campaign_id: "abc123def456",
      },
      {
        created_at: "2026-05-10T07:20:00Z",
        external_user_id: "ETORO_USR_002",
        event_name: "ftd",
        status: "confirmed",
        amount_usd: "150.00",
        currency: "USD",
        first_deposit: "1000.00",
        campaign_id: "xyz789ghi012",
      },
      {
        created_at: "2026-05-09T16:05:00Z",
        external_user_id: "ETORO_USR_003",
        event_name: "signup",
        status: "confirmed",
        amount_usd: "80.00",
        currency: "USD",
        first_deposit: "250.00",
        campaign_id: "",
      },
    ],
  },
  {
    filename: "trade_republic_test.csv",
    headers: [
      "conversion_date",
      "customer_ref",
      "type",
      "status",
      "commission",
      "currency",
      "first_deposit",
      "clickid",
    ],
    rows: [
      {
        conversion_date: "2026-05-11",
        customer_ref: "TR_USR_001",
        type: "signup",
        status: "confirmed",
        commission: "100.00",
        currency: "EUR",
        first_deposit: "500.00",
        clickid: "abc123def456",
      },
      {
        conversion_date: "2026-05-10",
        customer_ref: "TR_USR_002",
        type: "ftd",
        status: "confirmed",
        commission: "150.00",
        currency: "EUR",
        first_deposit: "1000.00",
        clickid: "xyz789ghi012",
      },
      {
        conversion_date: "2026-05-09",
        customer_ref: "TR_USR_003",
        type: "signup",
        status: "confirmed",
        commission: "80.00",
        currency: "EUR",
        first_deposit: "250.00",
        clickid: "",
      },
    ],
  },
];

async function main() {
  await mkdir(outputDir, { recursive: true });
  for (const dataset of datasets) {
    const csv = toCsv(dataset.headers, dataset.rows);
    const filePath = path.join(outputDir, dataset.filename);
    await writeFile(filePath, csv, "utf8");
    console.log(`Generated: ${filePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
