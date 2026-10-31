# Hacktoberfest After Dark

A Halloween-themed Hacktoberfest yearbook. Visitors sign by opening a public GitHub issue; a GitHub Actions workflow uses the issue author's GitHub login, assigns a random Halloween emoji, and creates and merges a bot-authored pull request containing that entry. The yearbook displays only the handle and emoji. It does not store a profile name, use OAuth, or require a database.

## Configure GitHub signing

1. Set `repository` in `public/site-config.json` to the public repository slug, for example `"owner/halloween-yearbook"`.
2. Push this project to that GitHub repository. The issue template creates a `Sign` issue, and `.github/workflows/sign-yearbook.yml` handles new issues with that exact title.
3. In the repository's **Settings → Actions → General**, allow workflows to have write permissions and allow GitHub Actions to create pull requests.
4. Ensure the repository allows squash merging and that branch protection permits the workflow token to merge after the workflow's roster validation succeeds.

The workflow derives the handle from GitHub's issue-author metadata; users cannot submit a different account name in the form. It chooses an emoji from the same `public/avatars.json` file shown on the page, rejects duplicate handles, and writes one file per signer under `data/signers/`. Separate files keep concurrent signups from conflicting with each other. The workflow builds and validates the roster, creates a bot pull request, and merges it. If repository rules prevent the merge, the workflow reports the failure and the pull request remains available for review.

Entries and sign requests are public. Only a GitHub handle and randomly assigned emoji are stored; profile names and email addresses are not copied. The workflow checks account control through issue authorship, not real-world identity.

## Run locally

Requirements: Node.js 22.13 or newer.

```powershell
npm install
npm start
```

Open <http://localhost:4174>. The `prestart` script bundles the browser AI worker, copies its WebAssembly runtime into the static output, and generates `public/signers.json` from the signer files. To run the build or the tests separately:

```powershell
npm run build
npm test
```

## Deploy

Build the static site with `npm run build` and publish the contents of `public/` to a static host. The generated `ai-worker.bundle.js`, `runtime/` files, and `signers.json` are build output and are not committed; the signer source data lives in `data/signers/`. If hosting as a Node.js service instead, `npm start` serves the same static build.

## Local AI oracle

The Graveyard Oracle uses the open-weight SmolLM2 360M Instruct model through Transformers.js. Press **“Let's see what the graves say”** to download the model on first use (about 200 MB) and generate a new short tip or challenge fact inside a browser Web Worker. Inference runs locally using the CPU and WebAssembly. The inference library and WebAssembly runtime are served by this app; the model is cached by the browser for later use.

Inference runs in the visitor's browser; GitHub handles and prompts are not sent to an AI service. The browser does need internet access to download model files from Hugging Face on first use. Generated facts can be wrong, so the oracle is grounded in the official Week 4 challenge details and labels its output for review. A modern browser and an internet connection for the initial download are required.
