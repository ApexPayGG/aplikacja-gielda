import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SEOHead } from "../components/SEOHead";
import {
  GLASS_BTN_PRIMARY,
  GLASS_HERO,
  GLASS_INPUT,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
} from "../components/behavioral-coach/glassStyles";

type HelpCategory = {
  icon: string;
  titleKey: string;
  titleDefault: string;
};

type FaqItem = {
  questionKey: string;
  questionDefault: string;
  answerKey: string;
  answerDefault: string;
};

const categories: HelpCategory[] = [
  { icon: "🚀", titleKey: "help.catGettingStarted", titleDefault: "Getting started" },
  { icon: "💳", titleKey: "help.catBilling", titleDefault: "Billing & subscription" },
  { icon: "📊", titleKey: "help.catSignals", titleDefault: "Signals & analysis" },
  { icon: "🤖", titleKey: "help.catCoach", titleDefault: "AI & Behavioral Coach" },
];

const faqItems: FaqItem[] = [
  {
    questionKey: "help.faq1q",
    questionDefault: "How do I get started with StockAI Pro?",
    answerKey: "help.faq1a",
    answerDefault:
      "Create an account, complete onboarding, and pick the modules you care about. Then configure signal preferences and start from the Dashboard.",
  },
  {
    questionKey: "help.faq2q",
    questionDefault: "What is the difference between Free and Pro?",
    answerKey: "help.faq2a",
    answerDefault:
      "Free includes core tools and a limited number of analyses. Pro unlocks advanced AI modules, more signals, and extended reports.",
  },
  {
    questionKey: "help.faq3q",
    questionDefault: "How does Paper Trading work?",
    answerKey: "help.faq3a",
    answerDefault:
      "Paper Trading lets you test investment decisions on virtual capital. You simulate trades without financial risk and review results like on a live market.",
  },
  {
    questionKey: "help.faq4q",
    questionDefault: "What is Behavioral Coach?",
    answerKey: "help.faq4a",
    answerDefault:
      "Behavioral Coach analyzes your investing habits and suggests how to reduce emotional mistakes. You get concrete tips tailored to your style.",
  },
  {
    questionKey: "help.faq5q",
    questionDefault: "How do I connect an eToro account?",
    answerKey: "help.faq5a",
    answerDefault:
      "Go to Settings, open Brokers, and select eToro. The CTA walks you through account linking and authorization.",
  },
  {
    questionKey: "help.faq6q",
    questionDefault: "How do AI signals work?",
    answerKey: "help.faq6a",
    answerDefault:
      "AI signals combine market data, sentiment, and price behavior context. Each signal includes scoring, rationale, and a suggested risk level.",
  },
  {
    questionKey: "help.faq7q",
    questionDefault: "Can I cancel my subscription?",
    answerKey: "help.faq7a",
    answerDefault:
      "Yes. Cancel anytime from payment settings. Pro access stays active until the end of the paid period.",
  },
  {
    questionKey: "help.faq8q",
    questionDefault: "How do I reset my password?",
    answerKey: "help.faq8a",
    answerDefault:
      'Open the login page and click "Forgot password?". You will receive an email with a link to set a new password.',
  },
  {
    questionKey: "help.faq9q",
    questionDefault: "What is Pre-Mortem AI?",
    answerKey: "help.faq9a",
    answerDefault:
      "Pre-Mortem AI simulates likely failure scenarios before you enter a trade. It helps assess risk and prepare an action plan.",
  },
  {
    questionKey: "help.faq10q",
    questionDefault: "How does Premium Analysis work?",
    answerKey: "help.faq10a",
    answerDefault:
      "Premium Analysis delivers deeper company reports: fundamentals, sector risks, and price scenarios. It is the extended analytics layer for Pro.",
  },
];

export function HelpPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqItems[0]?.questionKey ?? null);

  const localizedFaq = useMemo(
    () =>
      faqItems.map((item) => ({
        id: item.questionKey,
        question: t(item.questionKey, { defaultValue: item.questionDefault }),
        answer: t(item.answerKey, { defaultValue: item.answerDefault }),
      })),
    [t],
  );

  const filteredFaq = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return localizedFaq;
    return localizedFaq.filter((item) => {
      const content = `${item.question} ${item.answer}`.toLowerCase();
      return content.includes(normalizedSearch);
    });
  }, [localizedFaq, searchValue]);

  return (
    <div className={`${GLASS_PAGE_BG} px-4 py-10`}>
      <SEOHead
        title={t("help.seoTitle", { defaultValue: "Help Center | StockAI Pro" })}
        description={t("help.seoDescription", {
          defaultValue: "FAQ, help categories, and support contact for StockAI Pro.",
        })}
        ogType="website"
      />

      <div className="mx-auto max-w-5xl space-y-8">
        <header className={GLASS_HERO}>
          <h1 className={GLASS_PAGE_TITLE}>{t("help.title", { defaultValue: "Help Center" })}</h1>
          <p className={`${GLASS_PAGE_SUBTITLE} mt-2`}>
            {t("help.subtitle", {
              defaultValue: "Everything you need to use StockAI Pro effectively.",
            })}
          </p>

          <label htmlFor="help-search" className="mt-5 block text-sm font-medium text-white/70">
            {t("help.searchLabel", { defaultValue: "Search FAQ" })}
          </label>
          <input
            id="help-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("help.searchPlaceholder", { defaultValue: "Type a question or keyword..." })}
            className={`${GLASS_INPUT} mt-2 w-full`}
          />
        </header>

        <section aria-labelledby="help-categories" className="space-y-4">
          <h2 id="help-categories" className="text-xl font-semibold text-white">
            {t("help.categoriesTitle", { defaultValue: "Categories" })}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((category) => (
              <article key={category.titleKey} className={GLASS_SECTION}>
                <p className="text-2xl">{category.icon}</p>
                <h3 className="mt-3 text-base font-semibold text-white">
                  {t(category.titleKey, { defaultValue: category.titleDefault })}
                </h3>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="help-faq" className="space-y-4">
          <h2 id="help-faq" className="text-xl font-semibold text-white">
            {t("help.faqTitle", { defaultValue: "FAQ" })}
          </h2>

          <div className="space-y-3">
            {filteredFaq.map((item) => {
              const isOpen = openQuestion === item.id;
              return (
                <article key={item.id} className={`${GLASS_SECTION} overflow-hidden p-0`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenQuestion(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-white">{item.question}</span>
                    <span className="text-2xl leading-none text-[#22d3ee]" aria-hidden="true">
                      {isOpen ? "-" : "+"}
                    </span>
                  </button>
                  {isOpen ? <p className="border-t border-white/10 px-5 py-4 text-sm text-white/65">{item.answer}</p> : null}
                </article>
              );
            })}

            {filteredFaq.length === 0 ? (
              <p className={`${GLASS_SECTION} text-sm text-white/60`}>
                {t("help.noResults", {
                  defaultValue: "No results for your search. Try a different keyword.",
                })}
              </p>
            ) : null}
          </div>
        </section>

        <section className={`${GLASS_SECTION} text-center`}>
          <h2 className="text-2xl font-semibold text-white">{t("help.contactTitle", { defaultValue: "Still need help?" })}</h2>
          <p className="mt-2 text-sm text-white/65">
            {t("help.contactBody", { defaultValue: "Email us at" })}{" "}
            <a href="mailto:support@stock-ai.pro" className="font-semibold text-[#22d3ee] underline">
              support@stock-ai.pro
            </a>
          </p>
          <a href="mailto:support@stock-ai.pro" className={`${GLASS_BTN_PRIMARY} mt-5 inline-flex`}>
            {t("help.contactCta", { defaultValue: "Contact support" })}
          </a>
        </section>
      </div>
    </div>
  );
}
