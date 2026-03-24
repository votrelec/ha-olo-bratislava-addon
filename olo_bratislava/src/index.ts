import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PORT } from "./constants.ts";
import { OloBratislavaApp } from "./app.ts";

process.env.TZ = process.env.TZ || "Europe/Bratislava";

const app = new OloBratislavaApp();
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "web");

function sendJson(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response: import("node:http").ServerResponse, status: number, body: string) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readRequestBody(
  request: import("node:http").IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function serveStatic(
  response: import("node:http").ServerResponse,
  relativePath: string,
): Promise<void> {
  const filePath = path.join(webRoot, relativePath);
  const contentType =
    relativePath.endsWith(".css")
      ? "text/css; charset=utf-8"
      : relativePath.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : "text/html; charset=utf-8";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, 200, app.getSnapshot());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/notify-services") {
      sendJson(response, 200, { services: await app.getNotifyServices() });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/settings") {
      const payload = await readRequestBody(request);
      sendJson(response, 200, await app.saveSettings(payload));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/refresh") {
      await app.refresh("manual");
      sendJson(response, 200, app.getSnapshot());
      return;
    }
    if (request.method === "GET" && url.pathname === "/") {
      await serveStatic(response, "index.html");
      return;
    }
    if (request.method === "GET" && url.pathname === "/app.js") {
      await serveStatic(response, "app.js");
      return;
    }
    if (request.method === "GET" && url.pathname === "/styles.css") {
      await serveStatic(response, "styles.css");
      return;
    }
    sendText(response, 404, "Not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.statusCode = 500;
    response.end(message);
  }
});

await app.start();

server.listen(DEFAULT_PORT, () => {
  console.log(`OLO Bratislava ingress server listening on port ${DEFAULT_PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.shutdown();
    server.close(() => process.exit(0));
  });
}
