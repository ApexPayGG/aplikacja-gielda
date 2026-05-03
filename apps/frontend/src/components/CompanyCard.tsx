import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import type { Company } from "../services/api";

type Props = {
  company: Company;
};

export function CompanyCard({ company }: Props) {
  return (
    <Link
      to={`/company/${encodeURIComponent(company.symbol)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated transition hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
    >
      <div className="flex h-28 items-center justify-center bg-slate-900/80 p-4">
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt=""
            className="max-h-16 max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <BuildingOffice2Icon className="h-14 w-14 text-slate-600" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-semibold text-white group-hover:text-accent-muted">{company.name}</p>
        <p className="text-xs font-mono text-slate-500">{company.symbol}</p>
        <p className="text-sm text-slate-400">{company.sector}</p>
        <p className="line-clamp-2 text-xs text-slate-500">{company.industry}</p>
      </div>
    </Link>
  );
}
