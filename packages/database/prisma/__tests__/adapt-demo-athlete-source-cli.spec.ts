import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseSourceAdapterArgs,
  runDemoAthleteSourceAdaptation,
} from "../adapt-demo-athlete-source";
import { validateDemoAthleteDataset } from "../demo-athlete-importer";

const template = path.resolve(
  __dirname,
  "..",
  "demo_athlete_source_v1.json",
);

test("requires explicit JSON input and output paths", () => {
  assert.throws(() => parseSourceAdapterArgs([]), /--file/i);
  assert.throws(() => parseSourceAdapterArgs(["--file=source.json"]), /--out/i);
  assert.throws(
    () => parseSourceAdapterArgs(["--file=source.json", "--out=source.json"]),
    /different paths/i,
  );
});

test("accepts pnpm's standalone argument separator", () => {
  const options = parseSourceAdapterArgs([
    "--",
    "--file=source.json",
    "--out=canonical.json",
  ]);

  assert.match(options.file, /source\.json$/);
  assert.match(options.out, /canonical\.json$/);
});

test("converts the checked-in source template to canonical JSON", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fs-demo-adapter-"));
  const output = path.join(directory, "canonical.json");

  await runDemoAthleteSourceAdaptation([`--file=${template}`, `--out=${output}`]);

  const canonical = JSON.parse(await readFile(output, "utf8"));
  const validation = validateDemoAthleteDataset(canonical);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(validation.athletes.length, 1);
});

test("refuses to overwrite an existing output unless --force is explicit", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fs-demo-adapter-"));
  const output = path.join(directory, "canonical.json");
  const args = [`--file=${template}`, `--out=${output}`];

  await runDemoAthleteSourceAdaptation(args);
  await assert.rejects(runDemoAthleteSourceAdaptation(args), /already exists/i);
  await runDemoAthleteSourceAdaptation([...args, "--force"]);
});
