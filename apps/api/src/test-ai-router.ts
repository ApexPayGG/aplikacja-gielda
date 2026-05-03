import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function testHaiku(): Promise<void> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content:
          "Klasyfikuj ten news: 'CD Projekt Red obniżył prognozy Q3 o 15%'",
      },
    ],
  });
  const block = response.content[0];
  const answer = block.type === "text" ? block.text : "";
  console.log(`✅ Haiku: ${answer}`);
}

async function testSonnet(): Promise<void> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content:
          "Napisz 100-słowny brief dla spółki z rosnącą dywidendą i dobrymi wskaźnikami technicznymi",
      },
    ],
  });
  const block = response.content[0];
  const answer = block.type === "text" ? block.text : "";
  console.log(`✅ Sonnet: ${answer}`);
}

async function main(): Promise<void> {
  try {
    await testHaiku();
    await testSonnet();
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
