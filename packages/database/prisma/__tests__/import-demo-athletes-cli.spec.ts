import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { parseDemoImportArgs, readDemoDataset } from "../import-demo-athletes";
import { validateDemoAthleteDataset } from "../demo-athlete-importer";

test("uses dry-run mode and the pilot fixture by default", () => {
  const options = parseDemoImportArgs([]);

  assert.equal(options.apply, false);
  assert.match(options.file, /demo_athletes_seed\.json$/);
  assert.equal(options.target, undefined);
  assert.equal(options.withUsers, false);
});

test("accepts the opt-in --with-users flag", () => {
  const options = parseDemoImportArgs(["--with-users"]);

  assert.equal(options.withUsers, true);
  assert.equal(options.apply, false);
});

test("accepts pnpm's standalone argument separator", () => {
  const options = parseDemoImportArgs(["--", "--file=demo.json"]);

  assert.match(options.file, /demo\.json$/);
});

test("requires an explicit safe target before applying", () => {
  assert.throws(() => parseDemoImportArgs(["--apply"]), /requires --target/i);
  assert.throws(
    () => parseDemoImportArgs(["--apply", "--target=production"]),
    /local, development or staging/i,
  );
});

test("accepts every non-production target", () => {
  for (const target of ["local", "development", "staging"] as const) {
    const options = parseDemoImportArgs(["--apply", `--target=${target}`]);
    assert.equal(options.target, target);
  }
});

test("reads and validates the checked-in pilot fixture", async () => {
  const fixture = path.resolve(__dirname, "..", "demo_athletes_seed.json");
  const dataset = await readDemoDataset(fixture);
  const result = validateDemoAthleteDataset(dataset);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.athletes.length, 3);
});
