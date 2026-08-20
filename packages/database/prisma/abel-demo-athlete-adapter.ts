import type { DemoAthleteDataset } from "./demo-athlete.types";
import { validateDemoAthleteDataset } from "./demo-athlete-importer";

export interface AbelDemoAdaptation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dataset?: DemoAthleteDataset;
}

const REQUIRED_PRODUCT_FIELDS = [
  "search_position",
  "scenario",
  "advocacy_score",
  "trajectory",
  "fit_tags",
  "archetype",
  "self_representation",
  "non_negotiables",
  "scholarship_need",
] as const;

export function adaptAbelDemoAthleteDataset(
  input: unknown,
): AbelDemoAdaptation {
  if (Array.isArray(input)) {
    return invalid([
      "Legacy array detected. Wrap athletes in an object with schema_version, dataset, generated_at, and athletes.",
      "schema_version must be 1.",
      "generated_at must use YYYY-MM-DD format.",
    ]);
  }

  if (!isObject(input)) {
    return invalid(["Source dataset must be a JSON object."]);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.schema_version !== 1) {
    errors.push("schema_version must be 1.");
  }
  requiredString(input.dataset, "dataset", errors);
  if (!isIsoDate(input.generated_at)) {
    errors.push("generated_at must use a real YYYY-MM-DD date.");
  }
  if (!Array.isArray(input.athletes) || input.athletes.length === 0) {
    errors.push("athletes must contain at least one athlete.");
  } else {
    input.athletes.forEach((athlete, index) => {
      validateSourceAthlete(athlete, index, errors);
      collectSensitiveFieldWarnings(athlete, index, warnings);
    });
  }

  if (errors.length > 0) return { ...invalid(errors), warnings };

  const dataset: DemoAthleteDataset = {
    schemaVersion: 1,
    dataset: input.dataset as string,
    generatedAt: input.generated_at as string,
    athletes: (input.athletes as unknown[]).map((athlete) =>
      mapSourceAthlete(
        athlete as Record<string, unknown>,
        input.dataset as string,
      ),
    ),
  };
  const canonical = validateDemoAthleteDataset(dataset);
  if (!canonical.valid) {
    return {
      valid: false,
      errors: canonical.errors.map((error) => `Canonical output: ${error}`),
      warnings: [...warnings, ...canonical.warnings],
    };
  }

  return {
    valid: true,
    errors: [],
    warnings: [...warnings, ...canonical.warnings],
    dataset,
  };
}

function validateSourceAthlete(
  value: unknown,
  index: number,
  errors: string[],
): void {
  const path = `athletes[${index}]`;
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  const identity = isObject(value.identity) ? value.identity : {};
  const email = requiredString(
    identity.email,
    `${path}.identity.email`,
    errors,
  );
  if (email && !email.endsWith("@demo.firststringers.test")) {
    errors.push(`${path}.identity.email must use @demo.firststringers.test.`);
  }

  const product = isObject(value.first_stringers)
    ? value.first_stringers
    : undefined;
  if (!product) {
    errors.push(
      `${path}.first_stringers is required; missing ${REQUIRED_PRODUCT_FIELDS.join(", ")}.`,
    );
    return;
  }
  for (const field of REQUIRED_PRODUCT_FIELDS) {
    if (!(field in product)) {
      errors.push(`${path}.first_stringers.${field} is required.`);
    }
  }

  requiredString(
    product.search_position,
    `${path}.first_stringers.search_position`,
    errors,
  );
  requiredString(product.scenario, `${path}.first_stringers.scenario`, errors);
  requiredString(
    product.archetype,
    `${path}.first_stringers.archetype`,
    errors,
  );
  requiredString(
    product.self_representation,
    `${path}.first_stringers.self_representation`,
    errors,
  );
  if (
    typeof product.advocacy_score !== "number" ||
    !Number.isFinite(product.advocacy_score) ||
    product.advocacy_score < 0 ||
    product.advocacy_score > 1
  ) {
    errors.push(
      `${path}.first_stringers.advocacy_score must be between 0 and 1.`,
    );
  }
  if (!isStringArray(product.fit_tags)) {
    errors.push(`${path}.first_stringers.fit_tags must contain strings.`);
  }
  if (!isStringArray(product.non_negotiables)) {
    errors.push(
      `${path}.first_stringers.non_negotiables must contain strings.`,
    );
  }
  if (
    !["IMPROVING", "STABLE", "EMERGING"].includes(String(product.trajectory))
  ) {
    errors.push(`${path}.first_stringers.trajectory is invalid.`);
  }
  if (typeof product.scholarship_need !== "boolean") {
    errors.push(`${path}.first_stringers.scholarship_need must be a boolean.`);
  }
}

function mapSourceAthlete(value: Record<string, unknown>, dataset: string) {
  const identity = object(value.identity);
  const school = object(value.school_and_location);
  const physical = object(value.physical_profile);
  const measurements = object(value.athletic_measurements);
  const statistics = object(value.statistics);
  const sports = object(value.sports_profile);
  const academics = object(value.academics);
  const recruiting = object(value.recruiting_goals);
  const objectives = object(value.objectives);
  const character = object(value.character);
  const availability = object(value.availability);
  const multimedia = object(value.multimedia);
  const activity = object(value.recruiting_activity);
  const product = object(value.first_stringers);
  const highlights = strings([multimedia.primary_highlight_film]);
  const hudl = optionalText(multimedia.hudl_profile);
  const clips = strings(
    Object.entries(multimedia)
      .filter(([key]) => /^(full_game_film|training_film|camp_film)/.test(key))
      .map(([, item]) => item),
  );
  const goals = [
    ...stringArray(objectives.short_term),
    ...stringArray(objectives.long_term),
  ];

  return {
    fullName: text(identity.full_name),
    email: text(identity.email).toLowerCase(),
    sport: text(identity.sport).toLowerCase(),
    position: text(product.search_position).toUpperCase(),
    scenario: text(product.scenario),
    narrative: text(value.representation_summary),
    advocacyScore: finiteNumber(product.advocacy_score),
    dossier: {
      identity: {
        sport: text(identity.sport),
        position: joinPositions(
          identity.primary_position,
          identity.secondary_position,
        ),
        location: strings([school.city, school.state, school.country]).join(
          ", ",
        ),
        school: text(school.high_school),
        competitiveLevel: text(school.current_team_level),
        graduationYear: finiteNumber(identity.graduation_class),
        nationality: optionalText(identity.nationality),
      },
      performance: {
        stats: flattenNumericStats(statistics),
        leagueLevel: text(school.school_classification),
        physicalProfile: {
          height: text(physical.height),
          weight: formatMeasurement(physical.weight_lbs, "lb"),
          speed: formatMeasurement(
            measurements.forty_yard_dash_seconds,
            "s 40-yard dash",
          ),
          vertical: formatMeasurement(measurements.vertical_jump_inches, "in"),
          dominantSide: text(identity.dominant_hand),
        },
        strengths: stringArray(sports.primary_strengths),
        physicalStatus:
          availability.cleared_for_participation === true
            ? "Participation availability confirmed"
            : "Participation availability not confirmed",
        archetype: text(product.archetype),
        highlightUrls: highlights,
      },
      academic: {
        gpa: finiteNumber(academics.cumulative_gpa),
        satAct: optionalFiniteNumber(
          academics.sat_score ?? academics.act_score,
        ),
        intendedMajor: text(academics.intended_college_major),
        ncaaEligibility: /on track|eligible/i.test(
          text(academics.ncaa_eligibility_status),
        ),
        academicInterests: stringArray(academics.academic_interests),
      },
      availability: {
        transferPortal: parseTransferStatus(
          activity.transfer_status ?? availability.transfer_status,
        ),
        preferredRegions: strings([recruiting.geographic_preference]),
        scholarshipNeed: product.scholarship_need as boolean,
        timeline: text(activity.decision_timeline),
        competitiveLevelGoal: text(recruiting.target_college_level),
        goals,
        relocationOpenness:
          recruiting.open_to_national_opportunities === true
            ? "Open to national opportunities"
            : `Prefers ${text(recruiting.geographic_preference)}`,
        nonNegotiables: stringArray(product.non_negotiables),
      },
      media: {
        highlightUrls: highlights,
        clipUrls: clips,
        socialMedia: hudl ? { hudl } : {},
        references: coachReferences(school),
      },
      character: {
        mentality: text(character.observations),
        leadership: score(character.leadership),
        coachability: score(character.coachability),
        resilience: optionalText(character.response_to_adversity),
        motivation: goals.join("; "),
        growthAreas: stringArray(sports.areas_for_growth),
        selfRepresentation: text(product.self_representation),
      },
      fitTags: stringArray(product.fit_tags),
      trajectory: product.trajectory as "IMPROVING" | "STABLE" | "EMERGING",
      recruiterPitch: text(value.representation_summary),
      demoMetadata: {
        synthetic: true as const,
        dataset,
        source: "Abel demo athlete source v1",
      },
    },
  };
}

function collectSensitiveFieldWarnings(
  value: unknown,
  index: number,
  warnings: string[],
): void {
  if (!isObject(value)) return;
  const sensitiveFields = [
    ["identity", "date_of_birth"],
    ["identity", "age"],
    ["availability", "current_health_status"],
    ["availability", "current_injury"],
    ["availability", "previous_major_injuries"],
    ["availability", "surgery_history"],
    ["availability", "physical_restrictions"],
    ["verification", "date_of_birth"],
    ["verification", "medical_availability"],
  ] as const;
  for (const [sectionName, field] of sensitiveFields) {
    const section = object(value[sectionName]);
    if (field in section) {
      warnings.push(
        `athletes[${index}].${sectionName}.${field} was excluded from canonical output.`,
      );
    }
  }
}

function flattenNumericStats(value: Record<string, unknown>) {
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
    if (isObject(item)) {
      for (const [nestedKey, nested] of Object.entries(item)) {
        if (typeof nested === "number" && Number.isFinite(nested)) {
          result[nestedKey] = nested;
        }
      }
    }
  }
  return result;
}

function joinPositions(primary: unknown, secondary: unknown): string {
  return strings([primary, secondary]).join(" / ");
}

function coachReferences(school: Record<string, unknown>): string[] {
  const references: string[] = [];
  const headCoach = optionalText(school.head_coach);
  const positionCoach = optionalText(school.position_coach_or_coordinator);
  if (headCoach) references.push(`${headCoach} — Head Coach`);
  if (positionCoach)
    references.push(`${positionCoach} — Position Coach/Coordinator`);
  return references;
}

function parseTransferStatus(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("not transfer")) return false;
  return (
    normalized.includes("transfer portal") || normalized === "transferring"
  );
}

function score(value: unknown): string | undefined {
  const result = optionalFiniteNumber(value);
  return result === undefined ? undefined : `${result}/10`;
}

function formatMeasurement(value: unknown, unit: string): string | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  return `${value} ${unit}`;
}

function object(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | undefined {
  const result = text(value);
  return result || undefined;
}

function strings(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? strings(value) : [];
}

function isStringArray(value: unknown): value is string[] {
  return (
    stringArray(value).length > 0 &&
    stringArray(value).length === (value as unknown[]).length
  );
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.NaN;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function requiredString(
  value: unknown,
  path: string,
  errors: string[],
): string {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
    return "";
  }
  return value.trim();
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(errors: string[]): AbelDemoAdaptation {
  return { valid: false, errors, warnings: [] };
}
