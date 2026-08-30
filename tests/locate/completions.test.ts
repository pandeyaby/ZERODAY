import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompletionsEndpoint,
  assertNotChatCompletions,
  probeCompletionsEndpoint,
  postCompletions,
} from "../../src/locate/completions.ts";

describe("completions client (local vLLM)", () => {
  it("normalizes endpoint to /v1/completions", () => {
    assert.equal(
      normalizeCompletionsEndpoint("http://localhost:8000"),
      "http://localhost:8000/v1/completions",
    );
    assert.equal(
      normalizeCompletionsEndpoint("http://localhost:8000/v1"),
      "http://localhost:8000/v1/completions",
    );
    assert.equal(
      normalizeCompletionsEndpoint("http://localhost:8000/v1/completions"),
      "http://localhost:8000/v1/completions",
    );
  });

  it("rejects chat completions URLs", () => {
    assert.throws(
      () =>
        assertNotChatCompletions("http://localhost:8000/v1/chat/completions"),
      /\/v1\/completions/,
    );
  });

  it("probe and postCompletions talk HTTP without sending repo source", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "fdtn-ai/antares-1b" }] }), {
          status: 200,
        });
      }
      if (url.endsWith("/v1/completions")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          prompt?: string;
        };
        assert.ok(body.prompt);
        assert.doesNotMatch(body.prompt!, /src\/users\.js/);
        return new Response(
          JSON.stringify({ choices: [{ text: "ok" }] }),
          { status: 200 },
        );
      }
      return new Response("nope", { status: 404 });
    };
    const probe = await probeCompletionsEndpoint("http://127.0.0.1:8000/v1", {
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(probe.ok, true);
    assert.ok(probe.modelIds?.includes("fdtn-ai/antares-1b"));
    const post = await postCompletions({
      endpoint: "http://127.0.0.1:8000/v1",
      model: "fdtn-ai/antares-1b",
      prompt: "ping",
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(post.ok, true);
    assert.ok(calls.some((c) => c.includes("POST") && c.includes("/v1/completions")));
  });
});
