import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "about.html",
  "resources/index.html",
  "resources/mlg2msl/index.html",
];

test("local page assets and navigation targets exist", async () => {
  const missing = [];
  for (const page of pages) {
    const html = await readFile(path.join(projectRoot, page), "utf8");
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((reference) => !/^(?:https?:|data:|#)/.test(reference));

    for (const reference of references) {
      const cleanReference = reference.split(/[?#]/, 1)[0];
      let target = path.resolve(projectRoot, path.dirname(page), cleanReference);
      if (cleanReference.endsWith("/")) {
        target = path.join(target, "index.html");
      }
      try {
        await access(target);
      } catch {
        missing.push(`${page}: ${reference}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("converter uses a native button to open the file chooser", async () => {
  const html = await readFile(path.join(projectRoot, "resources/mlg2msl/index.html"), "utf8");
  const script = await readFile(path.join(projectRoot, "js/mlg-tool.mjs"), "utf8");

  assert.match(html, /<button[^>]+id="chooseMlgFile"[^>]+type="button"/);
  assert.match(html, /<input[^>]+id="mlgFile"[^>]+type="file"[^>]+hidden>/);
  assert.match(script, /chooseFileButton\.addEventListener\("click", \(\) => fileInput\.click\(\)\)/);
});
