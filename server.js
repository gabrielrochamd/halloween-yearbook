import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(projectDirectory, "public");
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/ai-worker.bundle.js", ["ai-worker.bundle.js", "text/javascript; charset=utf-8"]],
  ["/ai-worker.js", ["ai-worker.bundle.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/wallpaper.svg", ["wallpaper.svg", "image/svg+xml"]],
  ["/signers.json", ["signers.json", "application/json; charset=utf-8"]],
  ["/avatars.json", ["avatars.json", "application/json; charset=utf-8"]],
  ["/site-config.json", ["site-config.json", "application/json; charset=utf-8"]],
  ["/runtime/ort-wasm-simd-threaded.jsep.mjs", [
    path.join("runtime", "ort-wasm-simd-threaded.jsep.mjs"),
    "text/javascript; charset=utf-8",
  ]],
  ["/runtime/ort-wasm-simd-threaded.jsep.wasm", [
    path.join("runtime", "ort-wasm-simd-threaded.jsep.wasm"),
    "application/wasm",
  ]],
]);
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co; worker-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    ...securityHeaders,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

export function createServer() {
  return createHttpServer((request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (staticFiles.has(url.pathname)) {
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        return sendJson(response, 405, { error: "Method not allowed." });
      }

      const [fileName, contentType] = staticFiles.get(url.pathname);
      try {
        response.writeHead(200, {
          ...securityHeaders,
          "Cache-Control": "no-store",
          "Content-Type": contentType,
        });
        return response.end(readFileSync(path.join(publicDirectory, fileName)));
      } catch (error) {
        if (error.code === "ENOENT") {
          return sendJson(response, 503, { error: "The yearbook build is incomplete." });
        }
        console.error("Could not read yearbook asset:", error);
        return sendJson(response, 500, { error: "The yearbook could not load that asset." });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(response, 404, { error: "Not found." });
    }

    return sendJson(response, 404, { error: "Not found." });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 4174);
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Halloween yearbook is ready at http://localhost:${port}`);
  });
}
