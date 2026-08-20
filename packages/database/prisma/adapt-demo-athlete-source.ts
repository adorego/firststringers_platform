import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { adaptDemoAthleteSourceDataset } from "./demo-athlete-source-adapter";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

interface SourceAdapterOptions {
  file: string;
  out: string;
  force: boolean;
}

export function parseSourceAdapterArgs(args: string[]): SourceAdapterOptions {
  let file: string | undefined;
  let out: string | undefined;
  let force = false;

  for (const argument of args) {
    if (argument === "--") continue;
    if (argument === "--force") {
      force = true;
      continue;
    }
    if (argument.startsWith("--file=")) {
      file = resolveJsonPath(argument.slice("--file=".length), "--file");
      continue;
    }
    if (argument.startsWith("--out=")) {
      out = resolveJsonPath(argument.slice("--out=".length), "--out");
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!file) throw new Error("--file requires a source dataset JSON path.");
  if (!out) throw new Error("--out requires a canonical output JSON path.");
  if (file === out)
    throw new Error("--file and --out must use different paths.");
  return { file, out, force };
}

export async function runDemoAthleteSourceAdaptation(args: string[]): Promise<void> {
  const options = parseSourceAdapterArgs(args);
  const sourceStats = await stat(options.file);
  if (!sourceStats.isFile())
    throw new Error("Source path must reference a file.");
  if (sourceStats.size > MAX_SOURCE_BYTES) {
    throw new Error("Source dataset exceeds the 5 MB safety limit.");
  }

  let source: unknown;
  try {
    source = JSON.parse(await readFile(options.file, "utf8"));
  } catch {
    throw new Error("Source dataset contains invalid JSON.");
  }

  const result = adaptDemoAthleteSourceDataset(source);
  result.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  if (!result.valid || !result.dataset) {
    result.errors.forEach((error) => console.error(`Error: ${error}`));
    throw new Error("Adaptation blocked because source validation failed.");
  }

  try {
    await writeFile(
      options.out,
      `${JSON.stringify(result.dataset, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: options.force ? "w" : "wx",
      },
    );
  } catch (error) {
    if (isFileExistsError(error)) {
      throw new Error(
        "Output file already exists; pass --force to replace it.",
      );
    }
    throw error;
  }

  console.log(
    `Adapted ${result.dataset.athletes.length} athlete(s) to ${options.out}.`,
  );
}

function resolveJsonPath(value: string, option: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${option} requires a JSON file path.`);
  if (path.extname(result).toLowerCase() !== ".json") {
    throw new Error(`${option} must reference a .json file.`);
  }
  return path.resolve(result);
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

if (require.main === module) {
  runDemoAthleteSourceAdaptation(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Demo athlete adaptation failed.",
    );
    process.exitCode = 1;
  });
}
