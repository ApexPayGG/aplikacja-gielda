import { SEOHead } from "../components/SEOHead";

const missionValues = [
  {
    title: "Precyzja",
    description: "Analizy oparte na danych rynkowych, nie na opiniach i szumie informacyjnym.",
  },
  {
    title: "Psychologia",
    description: "Behavioral coaching jako fundament decyzji — nie dodatek do wykresów.",
  },
  {
    title: "Dostępność",
    description: "9 języków, 130+ giełd i plan startowy od 0 USD.",
  },
] as const;

const SUPPORT_EMAIL = "support@stock-ai.pro";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <SEOHead
        title="O StockAI Pro"
        description="Misja StockAI Pro: profesjonalne narzędzia inwestycyjne i coaching behawioralny dla inwestorów detalicznych."
        ogType="website"
      />

      <main className="mx-auto max-w-3xl px-6 py-20 md:py-28 lg:py-32">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-500">StockAI Pro</p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl md:leading-[1.1] lg:text-[3.25rem]">
          Budujemy narzędzie, które chcielibyśmy sami mieć.
        </h1>

        <p className="mt-8 text-lg leading-relaxed text-slate-600 md:text-xl md:leading-relaxed">
          Demokratyzujemy dostęp do profesjonalnych narzędzi inwestycyjnych. Inwestor detaliczny zasługuje na taką
          samą jakość analiz i wsparcia decyzyjnego jak instytucje — bez barier wejścia i bez zbędnej złożoności.
        </p>

        <div className="mt-16 grid gap-4 sm:grid-cols-3 sm:gap-5 md:mt-20">
          {missionValues.map((value) => (
            <article
              key={value.title}
              className="flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 transition-colors hover:border-slate-300 hover:bg-slate-50 md:p-6"
            >
              <h2 className="text-base font-semibold tracking-tight text-slate-950">{value.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{value.description}</p>
            </article>
          ))}
        </div>

        <p className="mt-16 border-t border-slate-200 pt-10 text-base text-slate-600 md:mt-20">
          Kontakt:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-[0.2em] transition hover:decoration-slate-950"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}
