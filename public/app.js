const signButton = document.querySelector("#sign-button");
const formStatus = document.querySelector("#form-status");
const signerGrid = document.querySelector("#signer-grid");
const signerCount = document.querySelector("#signer-count");
const signerLabel = document.querySelector("#signer-label");
const avatarOptions = document.querySelector("#avatar-options");
const oracleButton = document.querySelector("#oracle-button");
const oracleResult = document.querySelector("#oracle-result");
const oracleStatus = document.querySelector("#oracle-status");
const recentOracleAnswers = [];
let oracleWorker;
let signIssueUrl;

function setFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.dataset.error = String(isError);
}

function updateCount(count) {
  signerCount.textContent = String(count);
  signerLabel.textContent = count === 1 ? "soul signed" : "souls signed";
}

function createSignerCard(signer) {
  if (!signer || typeof signer.githubHandle !== "string" || typeof signer.emoji !== "string") {
    throw new Error("A yearbook entry is malformed.");
  }

  const card = document.createElement("article");
  card.className = "signer-card";

  const avatar = document.createElement("div");
  avatar.className = "signer-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = signer.emoji;

  const details = document.createElement("div");
  details.className = "signer-details";
  const profile = document.createElement("a");
  profile.className = "signer-handle";
  profile.href = `https://github.com/${encodeURIComponent(signer.githubHandle)}`;
  profile.target = "_blank";
  profile.rel = "noreferrer";
  profile.textContent = `@${signer.githubHandle}`;
  details.append(profile);

  card.append(avatar, details);
  return card;
}

function renderSigners(signers) {
  signerGrid.replaceChildren();
  updateCount(signers.length);

  if (signers.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✧";
    const message = document.createElement("p");
    message.textContent = "The hall is quiet… be the first to leave a haunt mark.";
    emptyState.append(mark, message);
    signerGrid.append(emptyState);
    return;
  }

  for (const signer of signers) signerGrid.append(createSignerCard(signer));
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
  return data;
}

async function loadSigners() {
  signerGrid.setAttribute("aria-busy", "true");

  try {
    const signers = await requestJson("/signers.json");
    if (!Array.isArray(signers)) throw new Error("The yearbook roster is not a list.");
    renderSigners(signers);
  } catch (error) {
    signerGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "grid-message grid-error";
    message.textContent = `${error.message} Refresh the page to try again.`;
    signerGrid.append(message);
  } finally {
    signerGrid.setAttribute("aria-busy", "false");
  }
}

async function loadAvatarOptions() {
  try {
    const emojis = await requestJson("/avatars.json");
    if (!Array.isArray(emojis) || emojis.length === 0) {
      throw new Error("The yearbook has no available spirit avatars.");
    }

    avatarOptions.replaceChildren();
    for (const emoji of emojis) {
      const avatar = document.createElement("span");
      avatar.className = "avatar-chip";
      avatar.textContent = emoji;
      avatarOptions.append(avatar);
    }
  } catch (error) {
    avatarOptions.replaceChildren();
    setFormStatus(`Could not load the Halloween avatars: ${error.message}`, true);
  }
}

async function configureSignLink() {
  try {
    const config = await requestJson("/site-config.json");
    if (typeof config.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) {
      throw new Error("Set the GitHub repository as owner/repository in site-config.json.");
    }

    signIssueUrl = `https://github.com/${config.repository}/issues/new?template=sign-yearbook.yml`;
    signButton.disabled = false;
    setFormStatus("Your GitHub login will be added publicly; the yearbook assigns your avatar.");
  } catch (error) {
    setFormStatus(error.message, true);
  }
}

function finishOracleRequest() {
  oracleButton.disabled = false;
  oracleButton.firstElementChild.textContent = "Let's see what the graves say";
  oracleResult.setAttribute("aria-busy", "false");
}

function setOracleStatus(message, isError = false) {
  oracleStatus.textContent = message;
  oracleStatus.dataset.error = String(isError);
}

function getOracleWorker() {
  if (oracleWorker) return oracleWorker;

  oracleWorker = new Worker("/ai-worker.bundle.js", { type: "module" });
  oracleWorker.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "status") {
      setOracleStatus(message.message);
      return;
    }

    if (message.type === "progress") {
      const progress = Number.isFinite(message.progress)
        ? ` ${Math.round(message.progress)}%`
        : "";
      setOracleStatus(`${message.message}${progress}`);
      return;
    }

    if (message.type === "answer") {
      oracleResult.textContent = message.text;
      recentOracleAnswers.push(message.text);
      if (recentOracleAnswers.length > 4) recentOracleAnswers.shift();
      setOracleStatus("Summoned locally. Check any factual claims before sharing.");
      finishOracleRequest();
      return;
    }

    if (message.type === "error") {
      setOracleStatus(message.message, true);
      finishOracleRequest();
    }
  });

  oracleWorker.addEventListener("error", (event) => {
    setOracleStatus(
      event.message
        ? `The local AI worker failed: ${event.message}`
        : "The local AI worker failed to start. Check your connection and try again.",
      true,
    );
    oracleWorker.terminate();
    oracleWorker = null;
    finishOracleRequest();
  });

  return oracleWorker;
}

oracleButton.addEventListener("click", () => {
  oracleButton.disabled = true;
  oracleButton.firstElementChild.textContent = "The ghosts are thinking…";
  oracleResult.setAttribute("aria-busy", "true");
  setOracleStatus("Waking the local model…");

  try {
    getOracleWorker().postMessage({ type: "generate", avoid: recentOracleAnswers });
  } catch (error) {
    setOracleStatus(`Could not start the local model: ${error.message}`, true);
    finishOracleRequest();
  }
});

signButton.addEventListener("click", () => {
  if (signIssueUrl) window.location.assign(signIssueUrl);
});

loadSigners();
loadAvatarOptions();
configureSignLink();
