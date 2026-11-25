import { EXIT_USAGE } from "./core/gate.js";
import { main } from "./program.js";

void main().catch((err) => {
  console.error(err);
  process.exitCode = EXIT_USAGE;
});
