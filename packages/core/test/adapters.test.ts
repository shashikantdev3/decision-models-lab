import { describe, expect, it } from "vitest";
import { ClaudeDecider, OpenRouterDecisions, ProviderError, parseDecisionsResponse } from "../src/index.ts";
import { fakeFetch, fixture, fixtureNames, toRequest } from "./helpers.ts";

const f = fixture("documented-shape.triage.json");

describe("OpenRouterDecisions", () => {
  it("posts to /alpha/decisions with state and questions, and parses the answers", async () => {
    const capture = { calls: [] as { url: string; init: RequestInit }[] };
    const m = new OpenRouterDecisions({
      apiKey: "test-key",
      modelId: "typesafe/jev-1.14",
      fetchImpl: fakeFetch(200, f.response, capture),
    });
    const r = await m.decide(toRequest(f.request));
    expect(capture.calls[0].url).toBe("https://openrouter.ai/api/alpha/decisions");
    const sent = JSON.parse(String(capture.calls[0].init.body));
    expect(sent).toEqual(f.request);
    expect((capture.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(r.answers.team.top).toBe("payments");
    expect(r.usage).toEqual({ inputTokens: 212, outputTokens: 2, costUsd: 0.0000089 });
    expect(r.servedModel).toBe("typesafe/jev-1.14-20261014");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("turns a 401 into a message that says what to do", async () => {
    const m = new OpenRouterDecisions({
      apiKey: "bad",
      modelId: "typesafe/jev-1.14",
      fetchImpl: fakeFetch(401, { error: { code: 401, message: "No auth credentials found" } }),
    });
    await expect(m.decide(toRequest(f.request))).rejects.toThrow(/OpenRouter rejected this key/);
  });

  it("marks rate limits as retryable and bad requests as not", async () => {
    const make = (status: number) =>
      new OpenRouterDecisions({
        apiKey: "k",
        modelId: "x",
        fetchImpl: fakeFetch(status, { error: { code: status, message: "x" } }),
      });
    const e429 = await make(429)
      .decide(toRequest(f.request))
      .catch((e) => e);
    const e400 = await make(400)
      .decide(toRequest(f.request))
      .catch((e) => e);
    expect(e429).toBeInstanceOf(ProviderError);
    expect(e429.retryable).toBe(true);
    expect(e400.retryable).toBe(false);
  });

  it("fails clearly when a question has no answer", () => {
    const body = { ...f.response, answers: { team: f.response.answers.team } };
    expect(() => parseDecisionsResponse("x", toRequest(f.request), body, 1)).toThrow(
      /no answer for question "urgent"/,
    );
  });

  it("parses every saved fixture that has a request and response", () => {
    for (const name of fixtureNames()) {
      const fx = fixture(name);
      if (!fx.request?.state) continue;
      const r = parseDecisionsResponse(fx.request.model, toRequest(fx.request), fx.response, 1);
      for (const a of Object.values(r.answers)) {
        expect(Object.values(a.probabilities).reduce((s, p) => s + p, 0)).toBeCloseTo(1, 2);
      }
    }
  });
});

describe("ClaudeDecider", () => {
  const tool = fixture("documented-shape.anthropic-tool.json").response;

  it("forces the tool and turns written probabilities into answers", async () => {
    const capture = { calls: [] as { url: string; init: RequestInit }[] };
    const m = new ClaudeDecider({
      apiKey: "k",
      modelId: "claude-haiku-4-5-20251001",
      fetchImpl: fakeFetch(200, tool, capture),
    });
    const r = await m.decide(toRequest(f.request));
    const sent = JSON.parse(String(capture.calls[0].init.body));
    expect(sent.tool_choice).toEqual({ type: "tool", name: "record_decisions" });
    expect(sent.temperature).toBe(0);
    expect(r.answers.urgent.value).toBeCloseTo(0.95);
    expect(r.answers.team.top).toBe("payments");
    expect(r.answers.severity.top).toBe("Critical");
    // 512 input tokens at $1/M + 96 output tokens at $5/M
    expect(r.usage.costUsd).toBeCloseTo(0.000512 + 0.00048, 8);
  });

  it("retries without temperature when the model rejects it", async () => {
    let n = 0;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      n++;
      const body = JSON.parse(String(init.body));
      if ("temperature" in body) {
        return new Response(
          JSON.stringify({ error: { message: "temperature is not supported for this model" } }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify(tool), { status: 200 });
    }) as unknown as typeof fetch;
    const m = new ClaudeDecider({ apiKey: "k", modelId: "claude-opus-5-5", fetchImpl });
    const r = await m.decide(toRequest(f.request));
    expect(n).toBe(2);
    expect(r.answers.team.top).toBe("payments");
  });

  it("falls back to tool_choice auto when the model rejects a forced tool", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (body.tool_choice.type === "tool") {
        return new Response(
          JSON.stringify({
            error: { message: 'tool_choice: type "tool" and "any" are not supported for this model.' },
          }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify(tool), { status: 200 });
    }) as unknown as typeof fetch;
    const m = new ClaudeDecider({ apiKey: "k", modelId: "claude-sonnet-5-5", fetchImpl });
    const r = await m.decide(toRequest(f.request));
    expect(bodies).toHaveLength(2);
    expect(bodies[1].tool_choice).toEqual({ type: "auto" });
    expect(String(bodies[1].system)).toMatch(/only by calling the record_decisions tool/);
    expect(r.answers.team.top).toBe("payments");
  });

  it("asks again when the tool answer leaves out a required field", async () => {
    let n = 0;
    const partial = {
      ...tool,
      content: [{ ...tool.content[0], input: { team: tool.content[0].input.team } }],
    };
    const fetchImpl = (async () => {
      n++;
      return new Response(JSON.stringify(n === 1 ? partial : tool), { status: 200 });
    }) as unknown as typeof fetch;
    const m = new ClaudeDecider({ apiKey: "k", modelId: "claude-sonnet-5-5", fetchImpl });
    const r = await m.decide(toRequest(f.request));
    expect(n).toBe(2);
    expect(r.answers.urgent.value).toBeCloseTo(0.95);
  });

  it("sends the browser header only when asked", async () => {
    const capture = { calls: [] as { url: string; init: RequestInit }[] };
    const m = new ClaudeDecider({
      apiKey: "k",
      modelId: "m",
      browser: true,
      fetchImpl: fakeFetch(200, tool, capture),
    });
    await m.decide(toRequest(f.request));
    expect(
      (capture.calls[0].init.headers as Record<string, string>)["anthropic-dangerous-direct-browser-access"],
    ).toBe("true");
  });
});
