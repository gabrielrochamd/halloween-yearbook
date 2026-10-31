import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { addSignerRecord, buildSignerIndex } from "../scripts/yearbook-data.js";
import { createServer } from "../server.js";

let server;
let baseUrl;
let temporaryDirectory;
const avatarsPath = fileURLToPath(new URL("../public/avatars.json", import.meta.url));

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "halloween-yearbook-"));
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("serves the yearbook, generated signer list, avatar list, and repository config", async () => {
  const [pageResponse, listResponse, avatarResponse, configResponse] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/signers.json`),
    fetch(`${baseUrl}/avatars.json`),
    fetch(`${baseUrl}/site-config.json`),
  ]);

  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.text();
  assert.match(page, /The yearbook/);
  assert.match(page, /Let's see what the graves say/);
  assert.match(page, /running right here in your browser/);
  assert.match(page, /Only your public GitHub handle and a random emoji are added/);
  assert.doesNotMatch(page, /name="name"/);
  assert.deepEqual(await listResponse.json(), []);
  assert.equal((await avatarResponse.json()).length, 8);
  assert.deepEqual(await configResponse.json(), { repository: "gabrielrochamd/halloween-yearbook" });
});

test("does not accept signatures through the removed database API", async () => {
  const response = await fetch(`${baseUrl}/api/signers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ghost", githubHandle: "spooky-maker", emoji: "👻" }),
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Not found.");
});

test("adds one random supported avatar for a handle and rejects duplicate handles", async () => {
  const signerDirectory = path.join(temporaryDirectory, "signers");
  const outputPath = path.join(temporaryDirectory, "public", "signers.json");
  const result = await addSignerRecord("Spooky-Maker", {
    signerDirectory,
    avatarPath: avatarsPath,
    outputPath,
  });

  assert.equal(result.added, true);
  assert.equal(result.signer.githubHandle, "Spooky-Maker");
  assert.ok(JSON.parse(await readFile(avatarsPath, "utf8")).includes(result.signer.emoji));
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), [result.signer]);

  const duplicate = await addSignerRecord("spooky-maker", {
    signerDirectory,
    avatarPath: avatarsPath,
    outputPath,
  });
  assert.equal(duplicate.added, false);
});

test("rejects roster entries with names or unsupported avatars", async () => {
  const signerDirectory = path.join(temporaryDirectory, "invalid-signers");
  await mkdir(signerDirectory, { recursive: true });
  await writeFile(path.join(signerDirectory, "ghost.json"), JSON.stringify({
    githubHandle: "ghost",
    emoji: "👻",
    name: "Must not be stored",
  }));

  await assert.rejects(() => buildSignerIndex({
    signerDirectory,
    avatarPath: avatarsPath,
    outputPath: path.join(temporaryDirectory, "invalid-public", "signers.json"),
  }), /only githubHandle and emoji/);
});

test("serves the original Halloween wallpaper asset", async () => {
  const response = await fetch(`${baseUrl}/wallpaper.svg`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await response.text(), /<svg/);
});

test("serves the bundled AI worker and local WASM runtime without a third-party script policy", async () => {
  const [workerResponse, pageResponse] = await Promise.all([
    fetch(`${baseUrl}/ai-worker.bundle.js`),
    fetch(baseUrl),
  ]);
  const worker = await workerResponse.text();
  const policy = pageResponse.headers.get("content-security-policy");

  assert.equal(workerResponse.status, 200);
  assert.match(worker, /SmolLM2-360M-Instruct/);
  assert.doesNotMatch(policy, /cdn\.jsdelivr\.net/);
  assert.match(policy, /https:\/\/\*\.huggingface\.co/);
  assert.match(policy, /wasm-unsafe-eval/);
  assert.match(policy, /worker-src 'self' blob:/);

  const runtimeResponse = await fetch(`${baseUrl}/runtime/ort-wasm-simd-threaded.jsep.mjs`);
  assert.equal(runtimeResponse.status, 200);
  assert.match(runtimeResponse.headers.get("content-type"), /javascript/);
});
