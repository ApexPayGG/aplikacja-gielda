import pino from "pino";

export interface ScoringInput {
  technical: number;
  history: number;
  sentiment: number;
  fundamentals: number;
  macro: number;
}

export const signalScoreLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "signal_score" },
});

function validateRange(name: keyof ScoringInput, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    signalScoreLogger.error({
      msg: "signal_score_validation_failed",
      field: name,
      value,
      reason: "out_of_range_0_100",
    });
    throw new Error(`Invalid ${name}: expected number in range 0-100, received ${value}`);
  }
}

export function scoreSignal(input: ScoringInput): { score: number; reasoning: string } {
  validateRange("technical", input.technical);
  validateRange("history", input.history);
  validateRange("sentiment", input.sentiment);
  validateRange("fundamentals", input.fundamentals);
  validateRange("macro", input.macro);

  const score = Math.round(
    input.technical * 0.3 +
      input.history * 0.3 +
      input.sentiment * 0.2 +
      input.fundamentals * 0.15 +
      input.macro * 0.05,
  );

  const reasoning = `Score ${score} bo: technical ${input.technical}, history ${input.history}, sentiment ${input.sentiment}, fundamentals ${input.fundamentals}, macro ${input.macro}`;

  signalScoreLogger.info({
    msg: "signal_score_calculated",
    score,
    input,
  });

  return { score, reasoning };
}
