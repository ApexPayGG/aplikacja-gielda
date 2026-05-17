import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, onSubmit, placeholder = "Search by name or symbol…" }: Props) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder === "Search by name or symbol…"
    ? t("home.searchPlaceholder", { defaultValue: "Search by name or symbol..." })
    : placeholder;

  return (
    <form
      className="flex w-full max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          data-shortcut-search="true"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          className="w-full rounded-xl border border-surface-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
      >
        {t("common.search")}
      </button>
    </form>
  );
}
