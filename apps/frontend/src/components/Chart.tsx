import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { QuoteRow } from "../services/api";
import { GLASS_INNER_PANEL, GLASS_SECTION } from "./behavioral-coach/glassStyles";

type Props = {
  quotes: QuoteRow[];
  title?: string;
};

export function Chart({ quotes, title = "Close (latest window)" }: Props) {
  const { t, i18n } = useTranslation();
  const data = quotes.map((q) => ({
    t: new Date(q.timestamp).toLocaleDateString(i18n.resolvedLanguage || "en", {
      day: "numeric",
      month: "short",
    }),
    close: Number(q.close),
  }));

  if (data.length === 0) {
    return (
      <div className={`flex h-64 items-center justify-center border-dashed ${GLASS_INNER_PANEL} text-sm text-[#94a3b8]`}>
        {t("company.noQuoteHistory", { defaultValue: "No quote history yet." })}
      </div>
    );
  }

  return (
    <div className={`${GLASS_SECTION} p-4`}>
      <h3 className="mb-4 text-sm font-medium text-slate-300">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4d" />
            <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a2332",
                border: "1px solid #2d3a4d",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              name={t("company.close", { defaultValue: "Close" })}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
