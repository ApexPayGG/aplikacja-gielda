import { useEffect } from "react";
import { Link } from "react-router-dom";
import { colors } from "../styles/designSystem";

export function AboutPage() {
  useEffect(() => {
    document.title = "O nas | StockAI Pro";
  }, []);

  return (
    <div
      className="min-h-screen bg-bgSecondary px-4 py-12 md:py-16"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.brandDark}08 0%, ${colors.bgSecondary} 35%)` }}
    >
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-bgPrimary p-6 shadow-sm md:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">StockAI Pro</p>
        <h1 className="mt-2 text-3xl font-bold text-textPrimary">O nas</h1>
        <p className="mt-4 text-sm leading-6 text-textSecondary">
          Tworzymy platformę, która łączy analizę rynku z AI i wsparciem behawioralnym, żeby inwestowanie było
          bardziej świadome i mniej impulsywne.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-bgSecondary p-5">
          <h2 className="text-lg font-semibold text-textPrimary">Masz pytania?</h2>
          <p className="mt-2 text-sm text-textSecondary">
            Napisz do nas przez formularz kontaktowy — odpiszemy możliwie szybko.
          </p>
          <Link
            to="/contact"
            className="mt-4 inline-flex rounded-lg bg-brandDark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandMedium"
          >
            Przejdź do kontaktu
          </Link>
        </div>
      </div>
    </div>
  );
}
