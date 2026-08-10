/**
 * Jerry eval runner — v1 (code-graded, no LLM judges yet).
 *
 * Suites:
 *   intents     — classification accuracy against a golden dataset
 *   extraction  — dossier extraction: expected fields present / equal / contained
 *   invariants  — conversational rules Jerry must never break (asks a question,
 *                 responds in English, no internal spec leakage, no guarantees)
 *
 * Usage (from apps/api, requires OPENAI_API_KEY in .env or the environment):
 *   pnpm eval:jerry
 *   pnpm eval:jerry -- --suite=intents
 *   pnpm eval:jerry -- --suite=intents,extraction --limit=10
 *
 * Calls the real OpenAI API — costs money. Run deliberately, not in CI (yet).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LLMService } from '../src/shared/llm/llm.service';
import { PromptBuilderService } from '../src/modules/jerry/prompt-builder.service';
import type { ConversationStrategy, JerryIntent } from '../src/shared/types';

// ── env loading (no dotenv dependency; pnpm does not hoist transitive deps) ──

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ── types ─────────────────────────────────────────────────────────────────────

interface IntentCase {
  id: string;
  message: string;
  expected: JerryIntent[];
}

interface Expectation {
  path: string;
  present?: boolean;
  equals?: unknown;
  contains?: string;
}

interface ExtractionCase {
  id: string;
  intent: JerryIntent;
  message: string;
  expect: Expectation[];
}

interface CaseResult {
  id: string;
  pass: boolean;
  detail: string;
}

interface SuiteResult {
  suite: string;
  total: number;
  passed: number;
  passRate: number;
  threshold: number;
  failures: CaseResult[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function getPath(target: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object') {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, target);
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function containsCi(value: unknown, needle: string): boolean {
  const lowered = needle.toLowerCase();
  if (typeof value === 'string') return value.toLowerCase().includes(lowered);
  if (typeof value === 'number') return String(value).includes(lowered);
  if (Array.isArray(value)) {
    return value.some((entry) => containsCi(entry, lowered));
  }
  return false;
}

function checkExpectation(
  extracted: unknown,
  expectation: Expectation,
): string | null {
  const value = getPath(extracted, expectation.path);
  if (expectation.present && !isPresent(value)) {
    return `${expectation.path} is missing or empty`;
  }
  if (expectation.equals !== undefined) {
    const matches =
      typeof expectation.equals === 'string' && typeof value === 'string'
        ? value.toLowerCase() === expectation.equals.toLowerCase()
        : value === expectation.equals;
    if (!matches) {
      return `${expectation.path} = ${JSON.stringify(value)}, expected ${JSON.stringify(expectation.equals)}`;
    }
  }
  if (expectation.contains !== undefined && !containsCi(value, expectation.contains)) {
    return `${expectation.path} = ${JSON.stringify(value)} does not contain "${expectation.contains}"`;
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ── suites ────────────────────────────────────────────────────────────────────

const DATASET_DIR = path.join(__dirname, 'datasets');
const CONCURRENCY = 4;

async function runIntents(llm: LLMService, limit?: number): Promise<SuiteResult> {
  let cases = readJsonl<IntentCase>(path.join(DATASET_DIR, 'jerry-intents.jsonl'));
  if (limit) cases = cases.slice(0, limit);

  const results = await mapPool(cases, CONCURRENCY, async (testCase) => {
    try {
      const actual = await llm.classify(testCase.message);
      const pass = testCase.expected.includes(actual);
      return {
        id: testCase.id,
        pass,
        detail: pass
          ? actual
          : `got "${actual}", expected one of [${testCase.expected.join(', ')}] — "${testCase.message}"`,
      };
    } catch (error) {
      return { id: testCase.id, pass: false, detail: `error: ${String(error)}` };
    }
  });

  return summarize('intents', results, 0.85);
}

async function runExtraction(llm: LLMService, limit?: number): Promise<SuiteResult> {
  let cases = readJsonl<ExtractionCase>(
    path.join(DATASET_DIR, 'jerry-extraction.jsonl'),
  );
  if (limit) cases = cases.slice(0, limit);

  const results = await mapPool(cases, CONCURRENCY, async (testCase) => {
    try {
      const extracted = await llm.extract(testCase.message, testCase.intent);
      const problems = testCase.expect
        .map((expectation) => checkExpectation(extracted, expectation))
        .filter((problem): problem is string => problem !== null);
      return {
        id: testCase.id,
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? 'ok'
            : `${problems.join('; ')} — "${testCase.message}"`,
      };
    } catch (error) {
      return { id: testCase.id, pass: false, detail: `error: ${String(error)}` };
    }
  });

  return summarize('extraction', results, 0.8);
}

interface InvariantCase {
  id: string;
  strategy: ConversationStrategy;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const INVARIANT_CASES: InvariantCase[] = [
  {
    id: 'inv-welcome',
    strategy: { type: 'welcome' },
    history: [],
  },
  {
    id: 'inv-strategic-ask',
    strategy: { type: 'strategic_ask', targetField: 'stats' },
    history: [
      { role: 'assistant', content: 'Great to meet you, Jerry.' },
      { role: 'user', content: "I'm a catcher at Westminster Christian in Miami." },
    ],
  },
  {
    id: 'inv-answer-redirect',
    strategy: { type: 'answer_and_redirect', targetField: 'gpa' },
    history: [
      { role: 'user', content: 'What do college coaches look for in a catcher?' },
    ],
  },
  {
    id: 'inv-confirm-probe',
    strategy: { type: 'confirm_and_probe', targetField: 'highlights' },
    history: [
      { role: 'user', content: 'I batted .410 with 8 home runs this season.' },
    ],
  },
];

async function runInvariants(llm: LLMService): Promise<SuiteResult> {
  const promptBuilder = new PromptBuilderService();

  const results = await mapPool(INVARIANT_CASES, 2, async (testCase) => {
    try {
      const raw = await llm.chat({
        systemPrompt: promptBuilder.build(testCase.strategy),
        messages: testCase.history.map((message) => ({
          ...message,
          timestamp: new Date(),
        })),
        extractedData: null,
      });
      // Same post-processing the worker applies before sending to the athlete.
      const response = promptBuilder.enforceConversationLeadership(
        raw,
        testCase.strategy,
      );

      const problems: string[] = [];
      if (!response || response.trim().length === 0) {
        problems.push('empty response');
      }
      if (!response.trimEnd().endsWith('?')) {
        problems.push('does not end with a question (Jerry must lead)');
      }
      const englishMarkers = ['the', 'you', 'your', 'to', 'and', 'a', 'of'];
      const words = response.toLowerCase().split(/\W+/);
      const englishHits = englishMarkers.filter((marker) =>
        words.includes(marker),
      ).length;
      if (response.includes('¿') || englishHits < 2) {
        problems.push('response does not look like English');
      }
      if (/fs-cs-\d/i.test(response)) {
        problems.push('leaks internal spec identifiers');
      }
      if (/guarantee[ds]?\b/i.test(response)) {
        problems.push('makes guarantees about outcomes');
      }
      if (response.length > 1500) {
        problems.push(`too long (${response.length} chars)`);
      }

      return {
        id: testCase.id,
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? 'ok'
            : `${problems.join('; ')} — "${response.slice(0, 140)}..."`,
      };
    } catch (error) {
      return { id: testCase.id, pass: false, detail: `error: ${String(error)}` };
    }
  });

  return summarize('invariants', results, 0.9);
}

// ── reporting ─────────────────────────────────────────────────────────────────

function summarize(
  suite: string,
  results: CaseResult[],
  threshold: number,
): SuiteResult {
  const passed = results.filter((result) => result.pass).length;
  return {
    suite,
    total: results.length,
    passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    threshold,
    failures: results.filter((result) => !result.pass),
  };
}

async function main(): Promise<void> {
  loadEnvFile(path.join(__dirname, '..', '.env'));

  const args = process.argv.slice(2);
  const suiteArg = args.find((arg) => arg.startsWith('--suite='));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const suites = suiteArg
    ? suiteArg.slice('--suite='.length).split(',')
    : ['intents', 'extraction', 'invariants'];
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;

  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  console.log(`\nJerry evals — model: ${model}\n`);

  const llm = new LLMService();
  const outcomes: SuiteResult[] = [];

  if (suites.includes('intents')) outcomes.push(await runIntents(llm, limit));
  if (suites.includes('extraction')) outcomes.push(await runExtraction(llm, limit));
  if (suites.includes('invariants')) outcomes.push(await runInvariants(llm));

  let failed = false;
  for (const outcome of outcomes) {
    const status = outcome.passRate >= outcome.threshold ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed = true;
    console.log(
      `${status}  ${outcome.suite.padEnd(11)} ${outcome.passed}/${outcome.total}  (${(outcome.passRate * 100).toFixed(0)}% — threshold ${(outcome.threshold * 100).toFixed(0)}%)`,
    );
    for (const failure of outcome.failures) {
      console.log(`      ✗ ${failure.id}: ${failure.detail}`);
    }
  }

  const reportDir = path.join(__dirname, 'reports');
  mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `jerry-${stamp}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify({ model, generatedAt: new Date().toISOString(), outcomes }, null, 2),
  );
  console.log(`\nReporte: ${reportPath}\n`);

  process.exitCode = failed ? 1 : 0;
}

void main();
