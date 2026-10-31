import { buildSignerIndex } from "./yearbook-data.js";

const signers = await buildSignerIndex();
console.log(`Built yearbook roster with ${signers.length} signer${signers.length === 1 ? "" : "s"}.`);
