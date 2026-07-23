import type { DossierData } from '../../shared/types';

const REGION_PATTERNS: Array<[RegExp, string]> = [
  [/\bmidwest\b/i, 'Midwest'],
  [/\bsouth\b/i, 'South'],
  [/\bsoutheast\b/i, 'Southeast'],
  [/\bnortheast\b/i, 'Northeast'],
  [/\bsouthwest\b/i, 'Southwest'],
  [/\bnorthwest\b/i, 'Northwest'],
  [/\beast coast\b/i, 'East Coast'],
  [/\bwest coast\b/i, 'West Coast'],
];

export function enhanceJerryExtraction(
  text: string,
  extractedData: Partial<DossierData> | null | undefined,
): Partial<DossierData> {
  const inferred: Partial<DossierData> = {};
  const preferredRegions = extractPreferredRegions(text);
  const competitiveLevelGoal = extractCompetitiveLevelGoal(text);
  const goal = extractPrimaryGoal(text);
  const selfRepresentation = extractSelfRepresentation(text);
  const strengths = selfRepresentation
    ? splitSignalList(selfRepresentation)
    : undefined;
  const growthArea = extractGrowthArea(text);
  const leadership = /\bteam captain\b/i.test(text)
    ? 'team captain'
    : undefined;

  if (preferredRegions?.length || competitiveLevelGoal || goal) {
    inferred.availability = {
      ...(preferredRegions?.length ? { preferredRegions } : {}),
      ...(competitiveLevelGoal ? { competitiveLevelGoal } : {}),
      ...(goal ? { goals: [goal] } : {}),
    };
  }

  if (selfRepresentation || growthArea || leadership) {
    inferred.character = {
      ...(selfRepresentation ? { selfRepresentation } : {}),
      ...(growthArea ? { growthAreas: [growthArea] } : {}),
      ...(leadership ? { leadership } : {}),
    };
  }

  if (strengths?.length) {
    inferred.performance = { strengths };
  }

  return mergeExtraction(extractedData ?? {}, inferred);
}

function mergeExtraction(
  base: Partial<DossierData>,
  inferred: Partial<DossierData>,
): Partial<DossierData> {
  return compactExtraction({
    ...base,
    availability: inferred.availability
      ? {
          ...base.availability,
          preferredRegions: mergeStringArrays(
            base.availability?.preferredRegions,
            inferred.availability.preferredRegions,
          ),
          competitiveLevelGoal:
            base.availability?.competitiveLevelGoal ??
            inferred.availability.competitiveLevelGoal,
          goals: mergeStringArrays(
            base.availability?.goals,
            inferred.availability.goals,
          ),
        }
      : base.availability,
    character: inferred.character
      ? {
          ...base.character,
          selfRepresentation:
            base.character?.selfRepresentation ??
            inferred.character.selfRepresentation,
          leadership:
            base.character?.leadership ?? inferred.character.leadership,
          growthAreas: mergeStringArrays(
            base.character?.growthAreas,
            inferred.character.growthAreas,
          ),
        }
      : base.character,
    performance: inferred.performance
      ? {
          ...base.performance,
          strengths: mergeStringArrays(
            base.performance?.strengths,
            inferred.performance.strengths,
          ),
        }
      : base.performance,
  });
}

function extractPreferredRegions(text: string): string[] | undefined {
  const regions = REGION_PATTERNS.filter(([pattern]) => pattern.test(text)).map(
    ([, region]) => region,
  );

  return regions.length > 0 ? regions : undefined;
}

function extractCompetitiveLevelGoal(text: string): string | undefined {
  const match = text.match(
    /\b((?:d[123]|naia|juco)(?:\s+or\s+(?:strong\s+)?(?:d[123]|naia|juco))?\s+program)\b/i,
  );

  return match ? normalizeCompetitiveLevel(match[1]) : undefined;
}

function extractPrimaryGoal(text: string): string | undefined {
  const match = text.match(/\b(?:my\s+)?main goal is to ([^.]+)/i);
  return match ? cleanSignal(match[1]) : undefined;
}

function extractSelfRepresentation(text: string): string | undefined {
  const match = text.match(/\bwhat separates me is ([^.]+)/i);
  return match ? cleanSignal(match[1]) : undefined;
}

function extractGrowthArea(text: string): string | undefined {
  const match = text.match(
    /\b(?:my\s+)?(?:biggest|main) growth area is ([^.]+)/i,
  );
  return match ? cleanSignal(match[1]) : undefined;
}

function splitSignalList(value: string): string[] {
  return value
    .replace(/\s+and\s+/gi, ',')
    .split(',')
    .map(cleanSignal)
    .filter(Boolean);
}

function cleanSignal(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();
}

function normalizeCompetitiveLevel(value: string): string {
  return cleanSignal(value).replace(/\bd([123])\b/gi, 'D$1');
}

function mergeStringArrays(
  base: string[] | undefined,
  inferred: string[] | undefined,
): string[] | undefined {
  const merged: string[] = [];

  for (const value of [...(base ?? []), ...(inferred ?? [])]) {
    const cleaned = cleanSignal(value);
    const alreadyIncluded = merged.some(
      (item) => item.toLowerCase() === cleaned.toLowerCase(),
    );
    if (cleaned && !alreadyIncluded) {
      merged.push(cleaned);
    }
  }

  return merged.length > 0 ? merged : undefined;
}

function compactExtraction(data: Partial<DossierData>): Partial<DossierData> {
  return Object.fromEntries(
    Object.entries(data)
      .map(([key, value]) => [key, compactSection(value)] as const)
      .filter(([, value]) => value !== undefined),
  ) as Partial<DossierData>;
}

function compactSection(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const compacted = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );

  return Object.keys(compacted).length > 0 ? compacted : undefined;
}
