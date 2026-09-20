/**
 * Loopback OpenAI-compatible completions mock for CI (no GPU / no RunPod).
 *
 * Serves GET /v1/models + POST /v1/completions with scripted Antares-shaped
 * tool_call text. Chat completions are refused (400) — same contract as live.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import { formatAntaresToolCall } from "./tool-call";

export interface MockCompletionsTurn {
  /** Completion text returned for this POST (Antares tool_call XML). */
  text: string;
}

export interface MockCompletionsServer {
  baseUrl: string;
  endpoint: string;
  modelsUrl: string;
  port: number;
  /** Number of POST /v1/completions received */
  completionHits: number;
  /** Number of GET /v1/models received */
  modelsHits: number;
  /** Captured POST bodies (prompt truncated in tests if needed) */
  posts: Array<{ model?: string; prompt?: string; stream?: boolean }>;
  close: () => Promise<void>;
}

export interface StartMockCompletionsOptions {
  modelId?: string;
  /** Scripted turns; exhausted turns return empty text */
  turns?: MockCompletionsTurn[];
  /** Host bind — always loopback for CI */
  host?: string;
}

/** Default scripted tool-call → submit path for demo-app CWE-89. */
export function defaultToolCallTurns(): MockCompletionsTurn[] {
  return [
    {
      text: formatAntaresToolCall("terminal", {
        command: "find . -type f -name '*.js'",
      }),
    },
    {
      text: formatAntaresToolCall("terminal", {
        command: "grep -Rni 'SELECT' .",
      }),
    },
    {
      text: formatAntaresToolCall("submit_vulnerable_files", {
        files: ["src/users.js", "src/app.js"],
      }),
    },
  ];
}

export async function startMockCompletionsServer(
  opts?: StartMockCompletionsOptions,
): Promise<MockCompletionsServer> {
  const modelId = opts?.modelId ?? "mock/antares-tool-calls";
  const turns = [...(opts?.turns ?? defaultToolCallTurns())];
  const host = opts?.host ?? "127.0.0.1";
  let turnIdx = 0;
  let completionHits = 0;
  let modelsHits = 0;
  const posts: MockCompletionsServer["posts"] = [];

  const server = http.createServer((req, res) => {
    const url = req.url ?? "";
    if (req.method === "GET" && (url === "/v1/models" || url.startsWith("/v1/models?"))) {
      modelsHits += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: modelId }] }));
      return;
    }
    if (req.method === "POST" && url === "/v1/chat/completions") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message:
              "Antares requires POST /v1/completions — chat completions refused",
            type: "invalid_request_error",
          },
        }),
      );
      return;
    }
    if (req.method === "POST" && url === "/v1/completions") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        completionHits += 1;
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
            string,
            unknown
          >;
        } catch {
          body = {};
        }
        posts.push({
          model: typeof body.model === "string" ? body.model : undefined,
          prompt: typeof body.prompt === "string" ? body.prompt : undefined,
          stream: body.stream === true,
        });
        const turn = turns[turnIdx] ?? { text: "" };
        turnIdx += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: `cmpl-mock-${completionHits}`,
            object: "text_completion",
            model: modelId,
            choices: [{ text: turn.text, index: 0, finish_reason: "stop" }],
          }),
        );
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, host, () => resolve());
    server.on("error", reject);
  });

  const addr = server.address() as AddressInfo;
  const baseUrl = `http://${host}:${addr.port}`;
  return {
    baseUrl,
    endpoint: `${baseUrl}/v1`,
    modelsUrl: `${baseUrl}/v1/models`,
    port: addr.port,
    get completionHits() {
      return completionHits;
    },
    get modelsHits() {
      return modelsHits;
    },
    get posts() {
      return posts;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
