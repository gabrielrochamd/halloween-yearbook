import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSignerIndex } from "./yearbook-data.js";

const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimeDirectory = path.join(projectDirectory, "public", "runtime");
const onnxRuntimeDirectory = path.join(projectDirectory, "node_modules", "onnxruntime-web", "dist");

await build({
  entryPoints: [path.join(projectDirectory, "public", "ai-worker.js")],
  outfile: path.join(projectDirectory, "public", "ai-worker.bundle.js"),
  bundle: true,
  format: "esm",
  minify: true,
  platform: "browser",
  target: "es2022",
});

await buildSignerIndex();
await rm(runtimeDirectory, { recursive: true, force: true });
await mkdir(runtimeDirectory, { recursive: true });
for (const extension of ["mjs", "wasm"]) {
  const runtimeFile = `ort-wasm-simd-threaded.${extension}`;
  await copyFile(
    path.join(onnxRuntimeDirectory, runtimeFile),
    path.join(runtimeDirectory, runtimeFile),
  );
}
