import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DecisionRequest, QuestionSet, Ticket } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, "../../..");

export const fixture = (name: string) => JSON.parse(readFileSync(resolve(here, "fixtures", name), "utf8"));
export const fixtureNames = () => readdirSync(resolve(here, "fixtures")).filter((f) => f.endsWith(".json"));

export function toRequest(body: {
  state: string[];
  questions: DecisionRequest["questions"];
}): DecisionRequest {
  return { context: body.state, questions: body.questions };
}

export const tickets: Ticket[] = readFileSync(resolve(root, "data/tickets.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

export const questions: QuestionSet = JSON.parse(
  readFileSync(resolve(root, "data/questions.v1.json"), "utf8"),
);

export function fakeFetch(
  status: number,
  body: unknown,
  capture?: { calls: { url: string; init: RequestInit }[] },
) {
  return (async (url: string, init: RequestInit) => {
    capture?.calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}
