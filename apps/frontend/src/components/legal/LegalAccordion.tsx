import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useId, useState, type ReactNode } from "react";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

type Props = {
  sections: LegalSection[];
};

export function LegalAccordion({ sections }: Props) {
  const baseId = useId();
  const defaultOpenId = sections.find((s) => s.defaultOpen)?.id ?? sections[0]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        const panelId = `${baseId}-${section.id}`;

        return (
          <article
            key={section.id}
            className="overflow-hidden rounded-2xl border border-border bg-bgPrimary shadow-sm"
          >
            <h2>
              <button
                type="button"
                id={`${panelId}-trigger`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-bgSecondary/60"
              >
                <span className="text-base font-semibold text-textPrimary">{section.title}</span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-brandCyan transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </h2>
            <div
              id={panelId}
              role="region"
              aria-labelledby={`${panelId}-trigger`}
              hidden={!isOpen}
              className="border-t border-border px-5 py-4"
            >
              <div className="space-y-3 text-sm leading-6 text-textSecondary">{section.content}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
