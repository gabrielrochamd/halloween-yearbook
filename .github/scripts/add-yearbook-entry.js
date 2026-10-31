import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { addSignerRecord } from "../../scripts/yearbook-data.js";

const outputFile = process.env.GITHUB_OUTPUT;
const handle = process.env.SIGNER_HANDLE;
const result = await addSignerRecord(handle);

if (outputFile) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  const output = result.added
    ? `added=true\npath=${path.relative(process.cwd(), result.signerPath).replaceAll("\\", "/")}\n`
    : "added=false\n";
  await appendFile(outputFile, output);
}

console.log(result.added
  ? `Prepared a yearbook entry for @${result.signer.githubHandle}.`
  : `@${handle} already has a yearbook entry.`);
