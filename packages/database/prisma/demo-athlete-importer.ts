import type {
  DemoAthleteDataset,
  DemoAthleteRecord,
  DemoDatasetValidation,
  DemoDossierData,
  DemoImportClient,
  DemoImportResult,
  DemoImportTarget,
  ValidatedDemoAthlete,
} from "./demo-athlete.types";

export type {
  DemoAthleteDataset,
  DemoAthleteRecord,
  DemoDatasetValidation,
  DemoDossierData,
  DemoImportClient,
  DemoImportResult,
  DemoImportTarget,
  ValidatedDemoAthlete,
} from "./demo-athlete.types";

export const DEMO_EMAIL_DOMAIN = "demo.firststringers.test";
export const MAX_DEMO_ATHLETES = 200;

type CountMap = Record<string, number>;

export function validateDemoAthleteDataset(
  input: unknown,
): DemoDatasetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validated: ValidatedDemoAthlete[] = [];
  const distribution = {
    sports: {} as CountMap,
    positions: {} as CountMap,
    scenarios: {} as CountMap,
  };

  if (!isObject(input)) {
    return invalidResult(["Dataset must be a JSON object."]);
  }
  rejectUnknownKeys(
    input,
    ["schemaVersion", "dataset", "generatedAt", "athletes"],
    "dataset",
    errors,
  );

  if (input.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }

  const datasetName = requiredString(input.dataset, "dataset", errors);
  if (!isIsoDate(input.generatedAt)) {
    errors.push("generatedAt must use YYYY-MM-DD format.");
  }

  if (!Array.isArray(input.athletes)) {
    return invalidResult([...errors, "athletes must be an array."]);
  }
  if (input.athletes.length === 0) {
    errors.push("athletes must contain at least one athlete.");
  }
  if (input.athletes.length > MAX_DEMO_ATHLETES) {
    errors.push(`A dataset may contain at most ${MAX_DEMO_ATHLETES} athletes.`);
  }

  const emails = new Set<string>();
  input.athletes.forEach((value, index) => {
    const path = `athletes[${index}]`;
    if (!isObject(value)) {
      errors.push(`${path} must be an object.`);
      return;
    }
    const before = errors.length;
    rejectUnknownKeys(
      value,
      [
        "fullName",
        "email",
        "sport",
        "position",
        "scenario",
        "narrative",
        "advocacyScore",
        "dossier",
      ],
      path,
      errors,
    );

    const fullName = requiredString(value.fullName, `${path}.fullName`, errors);
    const email = requiredString(
      value.email,
      `${path}.email`,
      errors,
    ).toLowerCase();
    const sport = requiredString(value.sport, `${path}.sport`, errors);
    const position = requiredString(value.position, `${path}.position`, errors);
    const scenario = requiredString(value.scenario, `${path}.scenario`, errors);
    requiredString(value.narrative, `${path}.narrative`, errors);
    boundedNumber(value.advocacyScore, `${path}.advocacyScore`, 0, 1, errors);

    if (email && !email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
      errors.push(
        `${path}.email must use the reserved demo domain @${DEMO_EMAIL_DOMAIN}.`,
      );
    }
    if (
      email &&
      !/^[a-z0-9][a-z0-9._-]*@demo\.firststringers\.test$/.test(email)
    ) {
      errors.push(`${path}.email must be a valid lowercase demo email.`);
    }
    if (email && emails.has(email)) {
      errors.push(`${path}.email contains duplicate email ${email}.`);
    }
    emails.add(email);

    if (findInternalJerryNote(value)) {
      errors.push(`${path} contains recruiter-visible internal Jerry notes.`);
    }

    validateDossier(value.dossier, path, datasetName, errors);

    if (errors.length === before) {
      const athlete = value as unknown as DemoAthleteRecord;
      const completeness = calculateDemoDossierCompleteness(athlete.dossier);
      if (completeness < 1) {
        errors.push(
          `${path}.dossier is ${(completeness * 100).toFixed(0)}% complete; demo athletes must be 100% complete.`,
        );
      } else {
        validated.push({ athlete, completeness });
        increment(distribution.sports, sport.toLowerCase());
        increment(distribution.positions, position.toUpperCase());
        increment(distribution.scenarios, scenario);
      }
    }

    if (fullName && !fullName.includes(" ")) {
      warnings.push(`${path}.fullName should include a first and last name.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    athletes: validated,
    distribution,
  };
}

export function calculateDemoDossierCompleteness(
  data: DemoDossierData,
): number {
  const checks = [
    hasValue(data.identity?.sport),
    hasValue(data.identity?.position),
    hasValue(data.identity?.graduationYear),
    hasValue(data.identity?.location),
    hasValue(data.identity?.school),
    hasValue(data.identity?.competitiveLevel),
    hasValue(data.performance?.physicalProfile?.height),
    hasValue(data.performance?.physicalProfile?.dominantSide),
    hasValue(data.performance?.stats),
    hasValue(data.performance?.leagueLevel),
    hasValue(data.performance?.strengths),
    hasValue(data.performance?.physicalStatus),
    hasValue(data.availability?.competitiveLevelGoal),
    hasValue(data.availability?.goals),
    hasValue(data.availability?.timeline),
    hasValue(data.availability?.preferredRegions),
    hasValue(data.availability?.relocationOpenness),
    hasValue(data.academic?.gpa),
    hasValue(data.academic?.intendedMajor),
    hasValue(data.availability?.nonNegotiables),
    hasValue(data.media?.highlightUrls),
    hasValue(data.media?.clipUrls),
    hasValue(data.media?.socialMedia),
    hasValue(data.media?.references),
    hasValue(data.character?.selfRepresentation),
    hasValue(data.character?.growthAreas),
    hasValue(data.character?.mentality),
    hasValue(data.character?.motivation),
  ];

  return checks.filter(Boolean).length / checks.length;
}

export async function importDemoAthletes(
  prisma: DemoImportClient,
  input: unknown,
  options: {
    target: DemoImportTarget;
    withUsers?: boolean;
    userPasswordHash?: string;
  },
): Promise<DemoImportResult> {
  if (!["local", "development"].includes(options.target)) {
    throw new Error(
      "Demo athlete imports may target only local or development.",
    );
  }

  if (options.withUsers && !/^\$2[aby]\$/.test(options.userPasswordHash ?? "")) {
    throw new Error(
      "--with-users requires a bcrypt password hash, never a plaintext password.",
    );
  }

  const validation = validateDemoAthleteDataset(input);
  if (!validation.valid) {
    throw new Error(
      `Demo athlete dataset is invalid:\n${validation.errors.join("\n")}`,
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const organization = await transaction.organization.upsert({
        where: { id: "seed-org-001" },
        update: {},
        create: { id: "seed-org-001", name: "First Stringers" },
      });

      let created = 0;
      let updated = 0;
      let users = 0;
      const representedAt = new Date(
        `${(input as DemoAthleteDataset).generatedAt}T00:00:00.000Z`,
      );

      for (const { athlete, completeness } of validation.athletes) {
        const existing = await transaction.athlete.findUnique({
          where: { email: athlete.email },
          include: { dossier: { select: { data: true } } },
        });

        if (existing && !isSyntheticDossier(existing.dossier?.data)) {
          throw new Error(
            `Refusing to overwrite ${athlete.email}: existing record is not marked as synthetic.`,
          );
        }

        const athleteRecord = await transaction.athlete.upsert({
          where: { email: athlete.email },
          update: {
            organizationId: organization.id,
            name: athlete.fullName,
            sport: athlete.sport,
            position: athlete.position,
            representationStatus: "verified",
            representedAt,
          },
          create: {
            organizationId: organization.id,
            email: athlete.email,
            name: athlete.fullName,
            sport: athlete.sport,
            position: athlete.position,
            representationStatus: "verified",
            representedAt,
          },
        });

        await transaction.dossier.upsert({
          where: { athleteId: athleteRecord.id },
          update: {
            data: athlete.dossier,
            completeness,
            narrative: athlete.narrative,
            advocacyScore: athlete.advocacyScore,
          },
          create: {
            athleteId: athleteRecord.id,
            data: athlete.dossier,
            completeness,
            narrative: athlete.narrative,
            advocacyScore: athlete.advocacyScore,
          },
        });

        if (options.withUsers) {
          await transaction.user.upsert({
            where: { email: athlete.email },
            update: {
              role: "ATHLETE",
              athleteId: athleteRecord.id,
            },
            create: {
              email: athlete.email,
              password: options.userPasswordHash,
              role: "ATHLETE",
              athleteId: athleteRecord.id,
              emailVerified: true,
              emailVerifiedAt: representedAt,
            },
          });
          users += 1;
        }

        if (existing) updated += 1;
        else created += 1;
      }

      return { created, updated, users, total: validation.athletes.length };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}

function validateDossier(
  value: unknown,
  athletePath: string,
  datasetName: string,
  errors: string[],
): void {
  const path = `${athletePath}.dossier`;
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  rejectUnknownKeys(
    value,
    [
      "identity",
      "performance",
      "academic",
      "availability",
      "media",
      "character",
      "fitTags",
      "trajectory",
      "recruiterPitch",
      "demoMetadata",
    ],
    path,
    errors,
  );

  const identity = section(value.identity, `${path}.identity`, errors);
  rejectUnknownKeys(
    identity,
    [
      "sport",
      "position",
      "location",
      "school",
      "club",
      "competitiveLevel",
      "graduationYear",
      "nationality",
    ],
    `${path}.identity`,
    errors,
  );
  requiredString(identity.sport, `${path}.identity.sport`, errors);
  requiredString(identity.position, `${path}.identity.position`, errors);
  requiredString(identity.location, `${path}.identity.location`, errors);
  requiredString(identity.school, `${path}.identity.school`, errors);
  optionalString(identity.club, `${path}.identity.club`, errors);
  requiredString(
    identity.competitiveLevel,
    `${path}.identity.competitiveLevel`,
    errors,
  );
  boundedNumber(
    identity.graduationYear,
    `${path}.identity.graduationYear`,
    2026,
    2035,
    errors,
  );
  optionalString(identity.nationality, `${path}.identity.nationality`, errors);

  const performance = section(value.performance, `${path}.performance`, errors);
  rejectUnknownKeys(
    performance,
    [
      "stats",
      "leagueLevel",
      "physicalProfile",
      "strengths",
      "physicalStatus",
      "archetype",
      "highlightUrls",
    ],
    `${path}.performance`,
    errors,
  );
  const stats = section(performance.stats, `${path}.performance.stats`, errors);
  if (Object.keys(stats).length === 0) {
    errors.push(
      `${path}.performance.stats must contain at least one statistic.`,
    );
  }
  for (const [key, stat] of Object.entries(stats)) {
    if (typeof stat !== "number" || !Number.isFinite(stat)) {
      errors.push(`${path}.performance.stats.${key} must be a finite number.`);
    }
  }
  requiredString(
    performance.leagueLevel,
    `${path}.performance.leagueLevel`,
    errors,
  );
  optionalString(
    performance.archetype,
    `${path}.performance.archetype`,
    errors,
  );
  requiredString(
    performance.physicalStatus,
    `${path}.performance.physicalStatus`,
    errors,
  );
  requiredStringArray(
    performance.strengths,
    `${path}.performance.strengths`,
    errors,
  );
  requiredHttpsUrls(
    performance.highlightUrls,
    `${path}.performance.highlightUrls`,
    errors,
  );
  const physical = section(
    performance.physicalProfile,
    `${path}.performance.physicalProfile`,
    errors,
  );
  rejectUnknownKeys(
    physical,
    ["height", "weight", "speed", "vertical", "dominantSide"],
    `${path}.performance.physicalProfile`,
    errors,
  );
  optionalString(
    physical.weight,
    `${path}.performance.physicalProfile.weight`,
    errors,
  );
  optionalString(
    physical.speed,
    `${path}.performance.physicalProfile.speed`,
    errors,
  );
  optionalString(
    physical.vertical,
    `${path}.performance.physicalProfile.vertical`,
    errors,
  );
  requiredString(
    physical.height,
    `${path}.performance.physicalProfile.height`,
    errors,
  );
  requiredString(
    physical.dominantSide,
    `${path}.performance.physicalProfile.dominantSide`,
    errors,
  );

  const academic = section(value.academic, `${path}.academic`, errors);
  rejectUnknownKeys(
    academic,
    ["gpa", "satAct", "intendedMajor", "ncaaEligibility", "academicInterests"],
    `${path}.academic`,
    errors,
  );
  boundedNumber(academic.gpa, `${path}.academic.gpa`, 0, 5, errors);
  optionalBoundedNumber(
    academic.satAct,
    `${path}.academic.satAct`,
    0,
    1600,
    errors,
  );
  requiredString(
    academic.intendedMajor,
    `${path}.academic.intendedMajor`,
    errors,
  );
  if (typeof academic.ncaaEligibility !== "boolean") {
    errors.push(`${path}.academic.ncaaEligibility must be a boolean.`);
  }
  optionalStringArray(
    academic.academicInterests,
    `${path}.academic.academicInterests`,
    errors,
  );

  const availability = section(
    value.availability,
    `${path}.availability`,
    errors,
  );
  rejectUnknownKeys(
    availability,
    [
      "transferPortal",
      "preferredRegions",
      "scholarshipNeed",
      "timeline",
      "competitiveLevelGoal",
      "goals",
      "limitations",
      "relocationOpenness",
      "nonNegotiables",
    ],
    `${path}.availability`,
    errors,
  );
  requiredStringArray(
    availability.preferredRegions,
    `${path}.availability.preferredRegions`,
    errors,
  );
  requiredString(
    availability.timeline,
    `${path}.availability.timeline`,
    errors,
  );
  requiredString(
    availability.competitiveLevelGoal,
    `${path}.availability.competitiveLevelGoal`,
    errors,
  );
  requiredStringArray(availability.goals, `${path}.availability.goals`, errors);
  optionalStringArray(
    availability.limitations,
    `${path}.availability.limitations`,
    errors,
  );
  requiredString(
    availability.relocationOpenness,
    `${path}.availability.relocationOpenness`,
    errors,
  );
  requiredStringArray(
    availability.nonNegotiables,
    `${path}.availability.nonNegotiables`,
    errors,
  );
  if (typeof availability.transferPortal !== "boolean") {
    errors.push(`${path}.availability.transferPortal must be a boolean.`);
  }
  if (typeof availability.scholarshipNeed !== "boolean") {
    errors.push(`${path}.availability.scholarshipNeed must be a boolean.`);
  }

  const media = section(value.media, `${path}.media`, errors);
  rejectUnknownKeys(
    media,
    ["highlightUrls", "clipUrls", "socialMedia", "references"],
    `${path}.media`,
    errors,
  );
  requiredHttpsUrls(media.highlightUrls, `${path}.media.highlightUrls`, errors);
  requiredHttpsUrls(media.clipUrls, `${path}.media.clipUrls`, errors);
  const social = section(
    media.socialMedia,
    `${path}.media.socialMedia`,
    errors,
  );
  rejectUnknownKeys(
    social,
    ["instagram", "twitter", "hudl", "other"],
    `${path}.media.socialMedia`,
    errors,
  );
  if (Object.keys(social).length === 0) {
    errors.push(`${path}.media.socialMedia must contain at least one profile.`);
  }
  for (const [key, profile] of Object.entries(social)) {
    const profilePath = `${path}.media.socialMedia.${key}`;
    optionalString(profile, profilePath, errors);
    if (typeof profile === "string" && profile.includes("://")) {
      validatePlaceholderUrl(profile, profilePath, errors);
    }
  }
  requiredStringArray(media.references, `${path}.media.references`, errors);

  const character = section(value.character, `${path}.character`, errors);
  rejectUnknownKeys(
    character,
    [
      "mentality",
      "leadership",
      "coachability",
      "resilience",
      "motivation",
      "growthAreas",
      "selfRepresentation",
    ],
    `${path}.character`,
    errors,
  );
  requiredString(character.mentality, `${path}.character.mentality`, errors);
  requiredString(character.motivation, `${path}.character.motivation`, errors);
  optionalString(character.leadership, `${path}.character.leadership`, errors);
  optionalString(
    character.coachability,
    `${path}.character.coachability`,
    errors,
  );
  optionalString(character.resilience, `${path}.character.resilience`, errors);
  requiredStringArray(
    character.growthAreas,
    `${path}.character.growthAreas`,
    errors,
  );
  requiredString(
    character.selfRepresentation,
    `${path}.character.selfRepresentation`,
    errors,
  );

  requiredStringArray(value.fitTags, `${path}.fitTags`, errors);
  if (!["IMPROVING", "STABLE", "EMERGING"].includes(String(value.trajectory))) {
    errors.push(`${path}.trajectory must be IMPROVING, STABLE, or EMERGING.`);
  }
  requiredString(value.recruiterPitch, `${path}.recruiterPitch`, errors);

  const metadata = section(value.demoMetadata, `${path}.demoMetadata`, errors);
  rejectUnknownKeys(
    metadata,
    ["synthetic", "dataset", "source"],
    `${path}.demoMetadata`,
    errors,
  );
  if (metadata.synthetic !== true) {
    errors.push(`${path}.demoMetadata.synthetic must be true.`);
  }
  if (metadata.dataset !== datasetName) {
    errors.push(`${path}.demoMetadata.dataset must match dataset.`);
  }
  optionalString(metadata.source, `${path}.demoMetadata.source`, errors);
}

function invalidResult(errors: string[]): DemoDatasetValidation {
  return {
    valid: false,
    errors,
    warnings: [],
    athletes: [],
    distribution: { sports: {}, positions: {}, scenarios: {} },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function section(
  value: unknown,
  path: string,
  errors: string[],
): Record<string, unknown> {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return {};
  }
  return value;
}

function requiredString(
  value: unknown,
  path: string,
  errors: string[],
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return "";
  }
  if (value.length > 2_000) {
    errors.push(`${path} exceeds the 2,000 character limit.`);
  }
  return value.trim();
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  path: string,
  errors: string[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path} contains unsupported field ${key}.`);
    }
  }
}

function requiredStringArray(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    )
  ) {
    errors.push(`${path} must be a non-empty string array.`);
  }
}

function optionalString(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) requiredString(value, path, errors);
}

function optionalStringArray(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (value !== undefined) requiredStringArray(value, path, errors);
}

function requiredHttpsUrls(
  value: unknown,
  path: string,
  errors: string[],
): void {
  requiredStringArray(value, path, errors);
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (typeof entry !== "string") return;
    validatePlaceholderUrl(entry, `${path}[${index}]`, errors);
  });
}

function validatePlaceholderUrl(
  value: string,
  path: string,
  errors: string[],
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${path} must be a valid URL.`);
    return;
  }
  if (url.protocol !== "https:") {
    errors.push(`${path} must use https.`);
  }
  if (url.hostname !== "example.com") {
    errors.push(`${path} must use the synthetic example.com host.`);
  }
}

function boundedNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: string[],
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    errors.push(`${path} must be a number between ${min} and ${max}.`);
  }
}

function optionalBoundedNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: string[],
): void {
  if (value !== undefined) boundedNumber(value, path, min, max, errors);
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function findInternalJerryNote(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(findInternalJerryNote);
  if (!isObject(value)) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      /jerry.*internal|internal.*jerry/i.test(key) ||
      findInternalJerryNote(child),
  );
}

function isSyntheticDossier(value: unknown): boolean {
  if (!isObject(value)) return false;
  const metadata = value.demoMetadata;
  return isObject(metadata) && metadata.synthetic === true;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function increment(target: CountMap, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}
