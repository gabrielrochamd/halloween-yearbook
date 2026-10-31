import { env, pipeline } from "@huggingface/transformers";

const modelId = "onnx-community/SmolLM2-360M-Instruct";
const officialChallengeFacts = [
  "The official Hacktoberfest Open-Source AI Challenge Week 4 theme is 'Ghost in the Machine'.",
  "The Week 4 challenge asks builders to make something spooky or honoring the past with open-weight models or open-source AI.",
  "The challenge encourages local inference and says the open pieces should be what makes a project work.",
  "The required DEV submission tag for the challenge is hf26challenge.",
  "The challenge judging criteria list writing quality as weighted most heavily, followed by relevance, creativity, technical execution, and optional partner technology.",
];

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/runtime/ort-wasm-simd-threaded`;

let generator;
let generatorPromise;

function postStatus(message) {
  self.postMessage({ type: "status", message });
}

function reportProgress(progress) {
  const percent = Number.isFinite(progress.progress)
    ? Math.max(0, Math.min(100, Math.round(progress.progress)))
    : null;

  self.postMessage({
    type: "progress",
    message: progress.status === "progress" ? "Downloading the open model…" : "Preparing the local model…",
    progress: percent,
  });
}

function buildPrompt(avoid) {
  const previousAnswers = Array.isArray(avoid)
    ? avoid.filter((answer) => typeof answer === "string").slice(-4)
    : [];
  const avoidSection = previousAnswers.length
    ? `\nDo not repeat or closely paraphrase these recent answers:\n${previousAnswers.map((answer) => `- ${answer}`).join("\n")}\n`
    : "";

  return `You are a funny, friendly Halloween guide for open-source contributors.

Write one fresh, useful tip OR one fun fact about open source or the Hacktoberfest Open-Source AI Challenge Week 4. Make it spooky and amusing, but keep it kind. Use one or two short sentences, no more than 40 words.

For factual claims, use only these verified challenge details:
${officialChallengeFacts.map((fact) => `- ${fact}`).join("\n")}

You may also give a general, practical open-source tip without presenting it as an official Hacktoberfest rule. Never invent dates, prizes, statistics, rules, or history. Do not claim a tip is an official requirement. Return only the tip or fact, without a heading or quotation marks.${avoidSection}`;
}

async function createGenerator() {
  return pipeline("text-generation", modelId, {
    device: "wasm",
    dtype: "q4",
    progress_callback: reportProgress,
  });
}

async function loadGenerator() {
  if (generator) return generator;
  if (generatorPromise) return generatorPromise;

  postStatus("Preparing the model for local CPU inference…");
  generatorPromise = createGenerator();

  try {
    generator = await generatorPromise;
    return generator;
  } catch (error) {
    generatorPromise = undefined;
    throw error;
  }
}

function readAnswer(result) {
  const generatedText = result?.[0]?.generated_text;
  if (typeof generatedText === "string") return generatedText.trim();
  if (Array.isArray(generatedText)) {
    const assistantMessage = [...generatedText].reverse().find((message) => message.role === "assistant");
    if (typeof assistantMessage?.content === "string") return assistantMessage.content.trim();
  }
  return "";
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "generate") return;

  try {
    const model = await loadGenerator();
    postStatus("Dreaming up a fresh CPU-powered answer…");
    const messages = [{ role: "user", content: buildPrompt(event.data.avoid) }];
    const options = {
      do_sample: true,
      max_new_tokens: 72,
      repetition_penalty: 1.15,
      temperature: 0.9,
      top_p: 0.92,
    };
    const result = await model(messages, options);
    const text = readAnswer(result);

    if (!text) throw new Error("The local model returned an empty answer. Please try again.");
    self.postMessage({ type: "answer", text });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Could not generate a local answer: ${error.message}`,
    });
  }
});
