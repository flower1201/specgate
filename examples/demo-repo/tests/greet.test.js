import assert from "node:assert/strict";
import { greet } from "../src/index.js";

assert.equal(greet("demo"), "hello, demo");
console.log("ok");
