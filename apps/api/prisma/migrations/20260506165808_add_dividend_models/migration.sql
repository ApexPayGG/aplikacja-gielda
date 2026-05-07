-- CreateTable
CREATE TABLE "dividends" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "ex_date" TIMESTAMP(3) NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dividend_yield" DOUBLE PRECISION,
    "frequency" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_histories" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "year" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "growth_yoy" DOUBLE PRECISION,
    "cagr_5y" DOUBLE PRECISION,
    "cagr_10y" DOUBLE PRECISION,

    CONSTRAINT "dividend_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dividends_symbol_ex_date_idx" ON "dividends"("symbol", "ex_date");

-- CreateIndex
CREATE INDEX "dividends_symbol_pay_date_idx" ON "dividends"("symbol", "pay_date");

-- CreateIndex
CREATE INDEX "dividend_histories_symbol_year_idx" ON "dividend_histories"("symbol", "year");

-- CreateIndex
CREATE UNIQUE INDEX "dividend_histories_symbol_year_key" ON "dividend_histories"("symbol", "year");

-- AddForeignKey
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_histories" ADD CONSTRAINT "dividend_histories_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
