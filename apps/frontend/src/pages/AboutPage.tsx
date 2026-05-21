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
    <div className="min-h-screen text-white antialiased">
      <SEOHead
        title="O StockAI Pro"
        description="Misja StockAI Pro: profesjonalne narzędzia inwestycyjne i coaching behawioralny dla inwestorów detalicznych."
        ogType="website"
      />

      <main className="mx-auto max-w-3xl px-6 py-20 md:py-28 lg:py-32">
        <p className="text-sm font-medium uppercase tracking-widest text-[#94a3b8]">StockAI Pro</p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.1] lg:text-[3.25rem]">
          Budujemy narzędzie, które chcielibyśmy sami mieć.
        </h1>

        <p className="mt-8 text-lg leading-relaxed text-[#94a3b8] md:text-xl md:leading-relaxed">
          Demokratyzujemy dostęp do profesjonalnych narzędzi inwestycyjnych. Inwestor detaliczny zasługuje na taką
          samą jakość analiz i wsparcia decyzyjnego jak instytucje — bez barier wejścia i bez zbędnej złożoności.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {missionValues.map((item) => (
            <article key={item.title} className="glass-section p-6">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{item.description}</p>
            </article>
          ))}
        </div>

        <p className="mt-16 text-sm text-[#94a3b8]">
          Pytania? Napisz na{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#22d3ee] hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
