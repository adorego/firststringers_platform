import type { DossierData } from '../../shared/types';

type PlainObject = Record<string, unknown>;

export function normalizeDossierData(input: unknown): DossierData {
  const source = asRecord(input);
  const identity = asRecord(source.identity);
  const performance = asRecord(source.performance);
  const physicalProfile = asRecord(performance.physicalProfile);
  const academic = asRecord(source.academic);
  const availability = asRecord(source.availability);
  const media = asRecord(source.media);
  const socialMedia = asRecord(media.socialMedia);
  const character = asRecord(source.character);

  return compactDossier({
    identity: compactObject({
      ...identity,
      graduationYear: coalesce(
        identity.graduationYear,
        numberValue(source.graduationYear),
      ),
      nationality: coalesce(
        identity.nationality,
        stringValue(source.nationality),
      ),
    }),
    performance: compactObject({
      ...performance,
      stats: coalesce(
        normalizeStats(performance.stats),
        normalizeStats(source.stats),
      ),
      leagueLevel: coalesce(
        performance.leagueLevel,
        stringValue(source.leagueLevel),
      ),
      strengths: coalesce(
        stringArray(performance.strengths),
        stringArray(source.keyStrengths),
      ),
      highlightUrls: coalesce(
        stringArray(performance.highlightUrls),
        stringArray(source.highlightUrls),
      ),
      physicalProfile: compactObject({
        ...physicalProfile,
        height: coalesce(
          physicalProfile.height,
          formatMeasurement(source.heightCm, 'cm'),
        ),
        weight: coalesce(
          physicalProfile.weight,
          formatMeasurement(source.weightKg, 'kg'),
        ),
      }),
    }),
    academic: compactObject({
      ...academic,
      gpa: coalesce(academic.gpa, numberValue(source.gpa)),
      satAct: coalesce(academic.satAct, numberValue(source.satScore)),
      intendedMajor: coalesce(
        academic.intendedMajor,
        stringValue(source.intendedMajor),
      ),
      ncaaEligibility: coalesce(
        academic.ncaaEligibility,
        booleanValue(source.ncaaEligible),
      ),
    }),
    availability: compactObject({
      ...availability,
      preferredRegions: coalesce(
        stringArray(availability.preferredRegions),
        stringArray(source.preferredRegions),
      ),
      scholarshipNeed: coalesce(
        availability.scholarshipNeed,
        booleanValue(source.scholarshipNeed),
      ),
      transferPortal: coalesce(
        availability.transferPortal,
        booleanValue(source.inTransferPortal),
      ),
    }),
    media: compactObject({
      ...media,
      highlightUrls: coalesce(
        stringArray(media.highlightUrls),
        stringArray(source.highlightUrls),
      ),
      socialMedia: compactObject(socialMedia),
    }),
    character: compactObject(character),
  });
}

export function calculateDossierCompleteness(input: unknown): number {
  const data = normalizeDossierData(input);
  const checks = [
    !!data.identity?.sport,
    !!data.identity?.position,
    !!data.identity?.graduationYear,
    !!data.identity?.location,
    !!data.identity?.school,
    !!data.identity?.competitiveLevel,
    !!data.performance?.physicalProfile?.height,
    !!data.performance?.physicalProfile?.dominantSide,
    hasValue(data.performance?.stats),
    !!data.performance?.leagueLevel,
    !!data.performance?.strengths?.length,
    !!data.performance?.physicalStatus,
    !!data.availability?.competitiveLevelGoal,
    !!data.availability?.goals?.length,
    !!data.availability?.timeline,
    !!data.availability?.preferredRegions?.length,
    !!data.availability?.relocationOpenness,
    hasValue(data.academic?.gpa),
    !!data.academic?.intendedMajor,
    !!data.availability?.nonNegotiables?.length,
    !!data.media?.highlightUrls?.length,
    !!data.media?.clipUrls?.length,
    hasValue(data.media?.socialMedia),
    !!data.media?.references?.length,
    !!data.character?.selfRepresentation,
    !!data.character?.growthAreas?.length,
    !!data.character?.mentality,
    !!data.character?.motivation,
  ];

  return checks.filter(Boolean).length / checks.length;
}

function compactDossier(sections: {
  identity?: PlainObject;
  performance?: PlainObject;
  academic?: PlainObject;
  availability?: PlainObject;
  media?: PlainObject;
  character?: PlainObject;
}): DossierData {
  return Object.fromEntries(
    Object.entries(sections).filter(([, value]) => hasValue(value)),
  ) as DossierData;
}

function compactObject(value: PlainObject): PlainObject | undefined {
  const compacted = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => hasValue(entry)),
  );

  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function asRecord(value: unknown): PlainObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PlainObject)
    : {};
}

function coalesce<T>(
  primary: T | undefined,
  fallback: T | undefined,
): T | undefined {
  return hasValue(primary) ? primary : fallback;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.keys(value as PlainObject).length > 0;
  }
  return true;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeStats(value: unknown): Record<string, number> | undefined {
  const stats = asRecord(value);
  const normalized = Object.fromEntries(
    Object.entries(stats)
      .filter(([, statValue]) => typeof statValue === 'number')
      .map(([key, statValue]) => [toCamelCase(key), statValue]),
  ) as Record<string, number>;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function toCamelCase(value: string): string {
  return value.replace(/[_-]([a-z0-9])/gi, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

function formatMeasurement(
  value: unknown,
  unit: 'cm' | 'kg',
): string | undefined {
  const number = numberValue(value);
  return number !== undefined ? `${number} ${unit}` : undefined;
}
