import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import BigNumber from "bignumber.js";
import {
  SafeGuardManager,
  type SafeGuardValidationResult,
} from "./SafeGuardManager";

const TEST_USER_ID = "safeguard-test-user";

type MockAutopilotSettings = {
  userId: string;
  isAutopilotEnabled: boolean;
  alpacaApiKeyEncrypted: string;
  alpacaApiSecretEncrypted: string;
  maxCapitalPerTradePct: Prisma.Decimal;
  maxDailyDrawdownPct: Prisma.Decimal;
  alpacaMode: "PAPER" | "LIVE";
};

type MockPortfolioSnapshot = {
  total_value: number;
  date: Date;
};

function isApproved(result: SafeGuardValidationResult): boolean {
  return result.ok;
}

function createAutopilotSettings(overrides: Partial<MockAutopilotSettings> = {}): MockAutopilotSettings {
  return {
    userId: TEST_USER_ID,
    isAutopilotEnabled: true,
    alpacaApiKeyEncrypted: "iv:tag:ciphertext-key",
    alpacaApiSecretEncrypted: "iv:tag:ciphertext-secret",
    maxCapitalPerTradePct: new Prisma.Decimal("0.02"),
    maxDailyDrawdownPct: new Prisma.Decimal("0.05"),
    alpacaMode: "PAPER",
    ...overrides,
  };
}

function createMockDb(input: {
  settings: MockAutopilotSettings | null;
  portfolioSnapshot: MockPortfolioSnapshot | null;
}): PrismaClient {
  const portfolioSnapshotCalls: Array<Record<string, unknown>> = [];

  const db = {
    userAutopilotSettings: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        if (!input.settings || where.userId !== input.settings.userId) {
          return null;
        }
        return input.settings;
      },
    },
    portfolioSnapshot: {
      findFirst: async (args: Record<string, unknown>) => {
        portfolioSnapshotCalls.push(args);
        return input.portfolioSnapshot;
      },
    },
    $queryRaw: async () => {
      throw new Error(
        "SafeGuardManager must not call $queryRaw in tests — use portfolioSnapshot.findFirst mock instead",
      );
    },
    __portfolioSnapshotCalls: portfolioSnapshotCalls,
  };

  return db as unknown as PrismaClient & {
    __portfolioSnapshotCalls: Array<Record<string, unknown>>;
  };
}

function expectedBuyQuantity(equity: number, maxCapitalPct: number, price: number): number {
  return new BigNumber(equity)
    .multipliedBy(maxCapitalPct)
    .dividedBy(price)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toNumber();
}

describe("SafeGuardManager", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("approves BUY sizing at 2% of equity with quantity 10 shares", async () => {
    const equity = 100_000;
    const price = 200;
    const maxCapitalPct = 0.02;

    const multipliedBySpy = mock.method(BigNumber.prototype, "multipliedBy", BigNumber.prototype.multipliedBy);
    const dividedBySpy = mock.method(BigNumber.prototype, "dividedBy", BigNumber.prototype.dividedBy);
    const integerValueSpy = mock.method(BigNumber.prototype, "integerValue", BigNumber.prototype.integerValue);

    const db = createMockDb({
      settings: createAutopilotSettings({
        maxCapitalPerTradePct: new Prisma.Decimal(String(maxCapitalPct)),
      }),
      portfolioSnapshot: {
        total_value: equity,
        date: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const manager = new SafeGuardManager(db);
    const result = await manager.validateAndSizeOrder(
      {
        userId: TEST_USER_ID,
        ticker: "AAPL",
        side: "BUY",
        currentPrice: price,
      },
      equity,
    );

    assert.equal(isApproved(result), true);
    if (!result.ok) {
      assert.fail(`Expected approved result, got rejection: ${result.reason}`);
    }

    assert.equal(result.calculatedQuantity, 10);
    assert.equal(result.maxNotional, "2000.0000");
    assert.equal(result.executionMode, "PAPER");
    assert.equal(expectedBuyQuantity(equity, maxCapitalPct, price), 10);

    assert.ok(multipliedBySpy.mock.callCount() >= 1, "BigNumber.multipliedBy should participate in sizing");
    assert.ok(dividedBySpy.mock.callCount() >= 1, "BigNumber.dividedBy should participate in sizing");
    assert.ok(integerValueSpy.mock.callCount() >= 1, "BigNumber.integerValue should floor share count");

    const portfolioCalls = (db as typeof db & { __portfolioSnapshotCalls: unknown[] }).__portfolioSnapshotCalls;
    assert.equal(portfolioCalls.length, 1, "portfolio_snapshots lookup should run once via Prisma findFirst");
  });

  it("blocks execution when daily drawdown exceeds limit and enters cooldown", async () => {
    const baselineEquity = 100_000;
    const currentEquity = 94_000;
    const maxDailyDrawdownPct = 0.05;

    const db = createMockDb({
      settings: createAutopilotSettings({
        maxDailyDrawdownPct: new Prisma.Decimal(String(maxDailyDrawdownPct)),
      }),
      portfolioSnapshot: {
        total_value: baselineEquity,
        date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    const drawdownPct = new BigNumber(baselineEquity)
      .minus(currentEquity)
      .dividedBy(baselineEquity)
      .multipliedBy(100)
      .toFixed(2);

    const manager = new SafeGuardManager(db);
    const result = await manager.validateAndSizeOrder(
      {
        userId: TEST_USER_ID,
        ticker: "AAPL",
        side: "BUY",
        currentPrice: 200,
      },
      currentEquity,
    );

    assert.equal(isApproved(result), false);
    if (result.ok) {
      assert.fail("Expected drawdown cooldown rejection");
    }

    assert.equal(result.code, "DAILY_DRAWDOWN_COOLDOWN");
    assert.match(result.reason, /cooldown active/i);
    assert.match(result.reason, /Daily drawdown/i);
    assert.match(result.reason, new RegExp(`${drawdownPct}%`));
    assert.match(result.reason, /5\.00%/);
  });
});
