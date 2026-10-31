import { randomInt } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const defaultAvatarPath = path.join(projectDirectory, "public", "avatars.json");
export const defaultSignerDirectory = path.join(projectDirectory, "data", "signers");
export const defaultSignerIndexPath = path.join(projectDirectory, "public", "signers.json");
const githubHandlePattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export async function readAvatarOptions(filePath = defaultAvatarPath) {
  const avatars = JSON.parse(await readFile(filePath, "utf8"));
  if (!Array.isArray(avatars) || avatars.length === 0 || !avatars.every((avatar) => typeof avatar === "string")) {
    throw new Error("The avatar list must be a non-empty array of emoji strings.");
  }
  if (new Set(avatars).size !== avatars.length) {
    throw new Error("The avatar list must not contain duplicate emoji.");
  }
  return avatars;
}

export function validateSignerRecord(value, avatarOptions) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each signer entry must be a JSON object.");
  }

  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "emoji" || keys[1] !== "githubHandle") {
    throw new Error("Signer entries must contain only githubHandle and emoji.");
  }
  if (typeof value.githubHandle !== "string" || !githubHandlePattern.test(value.githubHandle)) {
    throw new Error("A signer entry contains an invalid GitHub handle.");
  }
  if (!avatarOptions.includes(value.emoji)) {
    throw new Error(`The signer entry for @${value.githubHandle} uses an unsupported emoji.`);
  }

  return { githubHandle: value.githubHandle, emoji: value.emoji };
}

export async function buildSignerIndex({
  signerDirectory = defaultSignerDirectory,
  avatarPath = defaultAvatarPath,
  outputPath = defaultSignerIndexPath,
} = {}) {
  const avatarOptions = await readAvatarOptions(avatarPath);
  const fileNames = (await readdir(signerDirectory)).filter((fileName) => fileName.endsWith(".json"));
  const handles = new Set();
  const signers = [];

  for (const fileName of fileNames) {
    const filePath = path.join(signerDirectory, fileName);
    const signer = validateSignerRecord(JSON.parse(await readFile(filePath, "utf8")), avatarOptions);
    const normalizedHandle = signer.githubHandle.toLowerCase();

    if (fileName !== `${normalizedHandle}.json`) {
      throw new Error(`${fileName} must be named ${normalizedHandle}.json.`);
    }
    if (handles.has(normalizedHandle)) {
      throw new Error(`The yearbook contains more than one entry for @${signer.githubHandle}.`);
    }

    handles.add(normalizedHandle);
    signers.push(signer);
  }

  signers.sort((left, right) => left.githubHandle.toLowerCase().localeCompare(right.githubHandle.toLowerCase()));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(signers, null, 2)}\n`);
  return signers;
}

export async function addSignerRecord(handle, {
  signerDirectory = defaultSignerDirectory,
  avatarPath = defaultAvatarPath,
  outputPath = defaultSignerIndexPath,
} = {}) {
  if (typeof handle !== "string" || !githubHandlePattern.test(handle)) {
    throw new Error("The issue author does not have a valid GitHub handle.");
  }

  const avatarOptions = await readAvatarOptions(avatarPath);
  const signer = {
    githubHandle: handle,
    emoji: avatarOptions[randomInt(avatarOptions.length)],
  };
  validateSignerRecord(signer, avatarOptions);

  await mkdir(signerDirectory, { recursive: true });
  const signerPath = path.join(signerDirectory, `${handle.toLowerCase()}.json`);
  try {
    await writeFile(signerPath, `${JSON.stringify(signer, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") return { added: false, signerPath };
    throw error;
  }

  await buildSignerIndex({ signerDirectory, avatarPath, outputPath });
  return { added: true, signer, signerPath };
}
