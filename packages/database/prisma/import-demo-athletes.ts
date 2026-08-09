import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import {
  DemoAthleteDataset,
  DemoImportClient,
  DemoImportTarget,
  importDemoAthletes,
  validateDemoAthleteDataset,
} from "./demo-athlete-importer";

const DEFAULT_DATASET_PATH = path.join(__dirname, "demo_athletes_seed.json");
const MAX_DATASET_BYTES = 5 * 1024 * 1024;

interface CliOptions {
  apply: boolean;
  file: string;
  target?: DemoImportTarget;
  withUsers: boolean;
}

export function parseDemoImportArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    file: DEFAULT_DATASET_PATH,
    withUsers: false,
  };

  for (const argument of args) {
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (argument === "--with-users") {
      options.withUsers = true;
      continue;
    }
    if (argument.startsWith("--file=")) {
      const file = argument.slice("--file=".length).trim();
      if (!file) throw new Error("--file requires a JSON file path.");
      options.file = path.resolve(file);
      continue;
    }
    if (argument.startsWith("--target=")) {
      const target = argument.slice("--target=".length);
      if (target !== "local" && target !== "development") {
        throw new Error("--target must be local or development.");
      }
      options.target = target;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.apply && !options.target) {
    throw new Error("--apply requires --target=local or --target=development.");
  }

  return options;
}

export async function readDemoDataset(file: string): Promise<unknown> {
  if (path.extname(file).toLowerCase() !== ".json") {
    throw new Error("Demo athlete dataset must be a .json file.");
  }

  const fileStats = await stat(file);
  if (!fileStats.isFile())
    throw new Error("Dataset path must reference a file.");
  if (fileStats.size > MAX_DATASET_BYTES) {
    throw new Error("Dataset exceeds the 5 MB safety limit.");
  }

  const content = await readFile(file, "utf8");
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("Dataset contains invalid JSON.");
  }
}

export async function runDemoAthleteImport(args: string[]): Promise<void> {
  const options = parseDemoImportArgs(args);
  const dataset = await readDemoDataset(options.file);
  const validation = validateDemoAthleteDataset(dataset);

  printValidationReport(dataset, validation, options.file);
  if (!validation.valid) {
    throw new Error("Import blocked because dataset validation failed.");
  }

  if (!options.apply) {
    console.log("\nDRY RUN: no database connection or write was performed.");
    if (options.withUsers) {
      console.log(
        "--with-users: applying will also create ATHLETE login accounts for every record.",
      );
    }
    console.log(
      "To apply after review: pnpm demo:athletes -- --apply --target=development",
    );
    return;
  }

  const userPasswordHash = options.withUsers
    ? await bcrypt.hash(
        process.env.DEMO_ATHLETE_PASSWORD ?? "athlete123",
        12,
      )
    : undefined;

  const prisma = new PrismaClient();
  try {
    const result = await importDemoAthletes(
      prisma as unknown as DemoImportClient,
      dataset,
      { target: options.target!, withUsers: options.withUsers, userPasswordHash },
    );
    console.log(
      `\nIMPORT COMPLETE: ${result.created} created, ${result.updated} updated, ${result.users} users, ${result.total} total.`,
    );
    if (result.users > 0) {
      console.log(
        "Demo athlete logins use the demo email plus the DEMO_ATHLETE_PASSWORD env value (default athlete123).",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function printValidationReport(
  input: unknown,
  validation: ReturnType<typeof validateDemoAthleteDataset>,
  file: string,
): void {
  const dataset = input as Partial<DemoAthleteDataset>;
  console.log("Demo athlete dataset validation");
  console.log(`  File: ${file}`);
  console.log(`  Dataset: ${dataset.dataset ?? "unknown"}`);
  console.log(
    `  Records: ${Array.isArray(dataset.athletes) ? dataset.athletes.length : 0}`,
  );
  console.log(`  Status: ${validation.valid ? "VALID" : "INVALID"}`);

  for (const { athlete, completeness } of validation.athletes) {
    console.log(
      `  - ${athlete.fullName}: ${(completeness * 100).toFixed(0)}% | ${athlete.position} | ${athlete.scenario}`,
    );
  }

  console.log(`  Sports: ${JSON.stringify(validation.distribution.sports)}`);
  console.log(
    `  Positions: ${JSON.stringify(validation.distribution.positions)}`,
  );
  console.log(
    `  Scenarios: ${JSON.stringify(validation.distribution.scenarios)}`,
  );

  validation.warnings.forEach((warning) =>
    console.warn(`  Warning: ${warning}`),
  );
  validation.errors.forEach((error) => console.error(`  Error: ${error}`));
}

if (require.main === module) {
  runDemoAthleteImport(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Demo athlete import failed.",
    );
    process.exitCode = 1;
  });
}
