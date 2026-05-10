import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";

const MENTOR_MODEL = "claude-sonnet-4-20250514";

export type MentorInput = {
  ticker: string;
  setupType: string;
  riskScore: number;
  marketRegime: string;
  mentorStyle: "supportive" | "strict";
  lang: string;
};

export type MentorOutput = {
  title: string;
  guidance: string;
  riskCheck: string;
};

function normalizeMentorText(text: string): MentorOutput {
  const match = text.match(/\{[\s\S]*\}/);
  const payload = match ? match[0] : text;
  const parsed = JSON.parse(payload) as Partial<MentorOutput>;
  return {
    title: String(parsed.title ?? "Mentor note").trim(),
    guidance: String(parsed.guidance ?? "").trim(),
    riskCheck: String(parsed.riskCheck ?? "").trim(),
  };
}

export async function generateMentorGuidance(input: MentorInput): Promise<MentorOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Mentor mode requires Claude.");
  }

  const prompt = `You are an AI trading mentor for a retail investor.
Analyze the setup and return practical guidance.

Context:
- ticker: ${input.ticker}
- setupType: ${input.setupType}
- riskScore: ${input.riskScore}
- marketRegime: ${input.marketRegime}
- mentorStyle: ${input.mentorStyle}
- language: ${input.lang}

Return JSON only:
{
  "title": "short title, max 8 words",
  "guidance": "2 short actionable sentences, max 45 words total",
  "riskCheck": "one concrete risk-control reminder, max 20 words"
}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MENTOR_MODEL,
    max_tokens: 220,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  const text = content?.type === "text" ? content.text : "";
  return normalizeMentorText(text);
}
