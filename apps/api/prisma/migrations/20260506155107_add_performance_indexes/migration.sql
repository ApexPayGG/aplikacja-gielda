-- CreateTable
CREATE TABLE "companies" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "web_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,8) NOT NULL,
    "high" DECIMAL(18,8) NOT NULL,
    "low" DECIMAL(18,8) NOT NULL,
    "close" DECIMAL(18,8) NOT NULL,
    "volume" BIGINT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sentiment" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "technical_indicators" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indicator" TEXT NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "technical_indicators_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "fundamentals" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundamentals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_quotes_company_id_timestamp_desc" ON "quotes"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_symbol_timestamp_source_key" ON "quotes"("symbol", "timestamp", "source");

-- CreateIndex
CREATE INDEX "idx_news_company_id_published_at_desc" ON "news"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_indicators_company_id_date_desc" ON "technical_indicators"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "technical_indicators_symbol_timestamp_indicator_key" ON "technical_indicators"("symbol", "timestamp", "indicator");

-- CreateIndex
CREATE INDEX "fundamentals_symbol_idx" ON "fundamentals"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "fundamentals_symbol_metric_key" ON "fundamentals"("symbol", "metric");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_indicators" ADD CONSTRAINT "technical_indicators_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
