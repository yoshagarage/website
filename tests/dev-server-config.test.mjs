import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const config = require("../bs-config.js");

test("development server preserves multi-page directory routes", () => {
  assert.equal(config.server.middleware[1], null);
});
