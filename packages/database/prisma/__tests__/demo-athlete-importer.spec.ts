import assert from "node:assert/strict";
import test from "node:test";
import pilotDataset from "../demo_athletes_seed.json";
import {
  DEMO_EMAIL_DOMAIN,
  DemoAthleteDataset,
  DemoImportClient,
  importDemoAthletes,
  validateDemoAthleteDataset,
} from "../demo-athlete-importer";

function validAthlete(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Demo Athlete",
    email: `demo-athlete@${DEMO_EMAIL_DOMAIN}`,
    sport: "football",
    position: "QB",
    scenario: "proven-prospect",
    narrative: "A fictional athlete created for First Stringers product demos.",
    advocacyScore: 0.9,
    dossier: {
      identity: {
        sport: "Football",
        position: "Quarterback",
        location: "Demo City, Florida, United States",
        school: "Demo High School",
        competitiveLevel: "Varsity",
        graduationYear: 2027,
        nationality: "United States",
      },
      performance: {
        stats: { gamesPlayed: 12 },
        leagueLevel: "NCAA Division I prospect",
        physicalProfile: {
          height: "6 ft 3 in",
          weight: "205 lb",
          speed: "4.71 s 40-yard dash",
          vertical: "34 in",
          dominantSide: "Right",
        },
        strengths: ["Leadership"],
        physicalStatus: "Fully healthy and cleared for participation",
        archetype: "Proven field general",
        highlightUrls: ["https://example.com/demo-highlights"],
      },
      academic: {
        gpa: 3.8,
        satAct: 1240,
        intendedMajor: "Business Administration",
        ncaaEligibility: true,
        academicInterests: ["Leadership"],
      },
      availability: {
        transferPortal: false,
        preferredRegions: ["Southeast United States"],
        scholarshipNeed: true,
        timeline: "After senior season",
        competitiveLevelGoal: "NCAA Division I",
        goals: ["Become a college starter"],
        limitations: ["None identified"],
        relocationOpenness: "Open to national opportunities",
        nonNegotiables: ["Strong academic fit"],
      },
      media: {
        highlightUrls: ["https://example.com/demo-highlights"],
        clipUrls: ["https://example.com/demo-game"],
        socialMedia: {
          instagram: "@DemoAthlete",
          hudl: "https://example.com/demo-hudl",
        },
        references: ["Demo Coach — Head Football Coach"],
      },
      character: {
        mentality: "Prepared and competitive",
        leadership: "Team captain",
        coachability: "Responds well to direct feedback",
        resilience: "Strong response to adversity",
        motivation: "Compete and graduate",
        growthAreas: ["Deep-ball consistency"],
        selfRepresentation: "A prepared teammate who leads by example",
      },
      fitTags: ["verified-production", "strong-academics"],
      trajectory: "IMPROVING",
      recruiterPitch: "A verified, academically qualified prospect.",
      demoMetadata: {
        synthetic: true,
        dataset: "fs-pilot-2026-08",
      },
    },
    ...overrides,
  };
}

function dataset(athletes = [validAthlete()]): DemoAthleteDataset {
  return {
    schemaVersion: 1,
    dataset: "fs-pilot-2026-08",
    generatedAt: "2026-08-04",
    athletes: athletes as DemoAthleteDataset["athletes"],
  };
}

test("accepts a complete synthetic athlete and computes product completeness", () => {
  const result = validateDemoAthleteDataset(dataset());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.athletes[0].completeness, 1);
});

test("validates pilot athletes with distinct recruiter scenarios", () => {
  const result = validateDemoAthleteDataset(pilotDataset);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.athletes.length, 3);
  assert.deepEqual(result.distribution.positions, { QB: 1, S: 1, OL: 1 });
  assert.deepEqual(result.distribution.scenarios, {
    "proven-prospect": 1,
    "underexposed-discovery": 1,
    "developmental-upside": 1,
  });
  assert.ok(result.athletes.every(({ completeness }) => completeness === 1));
});

test("rejects duplicate deterministic emails", () => {
  const athlete = validAthlete();
  const result = validateDemoAthleteDataset(dataset([athlete, athlete]));

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /duplicate email/i);
});

test("rejects emails outside the reserved synthetic domain", () => {
  const result = validateDemoAthleteDataset(
    dataset([validAthlete({ email: "real-athlete@example.com" })]),
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /reserved demo domain/i);
});

test("rejects missing recruiter search fields", () => {
  const result = validateDemoAthleteDataset(
    dataset([validAthlete({ position: "" })]),
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /position/i);
});

test("caps a dataset at 200 athletes", () => {
  const athletes = Array.from({ length: 201 }, (_, index) =>
    validAthlete({ email: `demo-${index}@${DEMO_EMAIL_DOMAIN}` }),
  );
  const result = validateDemoAthleteDataset(dataset(athletes));

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /at most 200/i);
});

test("rejects recruiter-visible internal Jerry notes", () => {
  const athlete = validAthlete();
  (athlete.dossier as Record<string, unknown>).jerryInternalNotes =
    "Never expose this.";

  const result = validateDemoAthleteDataset(dataset([athlete]));

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /internal Jerry notes/i);
});

test("rejects unexpected personal-data fields produced by a model", () => {
  const athlete = validAthlete();
  (athlete.dossier as Record<string, unknown>).parentPhone = "(555) 555-0100";

  const result = validateDemoAthleteDataset(dataset([athlete]));

  assert.equal(result.valid, false);
  assert.equal(result.athletes.length, 0);
  assert.match(result.errors.join("\n"), /unsupported field.*parentPhone/i);
});

test("rejects non-placeholder media URLs", () => {
  const athlete = validAthlete();
  athlete.dossier.media.highlightUrls = [
    "https://real-athlete-site.invalid/highlights",
  ];

  const result = validateDemoAthleteDataset(dataset([athlete]));

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /example\.com/i);
});

test("rejects impossible generated dates and unknown trajectories", () => {
  const invalidDate = dataset();
  invalidDate.generatedAt = "2026-99-99";
  const athlete = validAthlete();
  (athlete.dossier as Record<string, unknown>).trajectory = "GUARANTEED";

  const dateResult = validateDemoAthleteDataset(invalidDate);
  const trajectoryResult = validateDemoAthleteDataset(dataset([athlete]));

  assert.equal(dateResult.valid, false);
  assert.match(dateResult.errors.join("\n"), /generatedAt/i);
  assert.equal(trajectoryResult.valid, false);
  assert.match(trajectoryResult.errors.join("\n"), /trajectory/i);
});

test("creates only organization, athlete, and dossier records", async () => {
  const calls: string[] = [];
  const prisma = fakePrisma(calls, new Map());

  const result = await importDemoAthletes(prisma, dataset(), {
    target: "development",
  });

  assert.deepEqual(result, { created: 1, updated: 0, users: 0, total: 1 });
  assert.deepEqual(calls, [
    "transaction",
    "organization.upsert",
    "athlete.findUnique",
    "athlete.upsert",
    "dossier.upsert",
  ]);
});

test("creates login users only when withUsers is set", async () => {
  const calls: string[] = [];
  const prisma = fakePrisma(calls, new Map());

  const result = await importDemoAthletes(prisma, dataset(), {
    target: "development",
    withUsers: true,
    userPasswordHash: "$2b$12$demohashdemohashdemohashdemohash",
  });

  assert.deepEqual(result, { created: 1, updated: 0, users: 1, total: 1 });
  assert.deepEqual(calls, [
    "transaction",
    "organization.upsert",
    "athlete.findUnique",
    "athlete.upsert",
    "dossier.upsert",
    "user.upsert",
  ]);
});

test("rejects withUsers without a bcrypt password hash", async () => {
  await assert.rejects(
    importDemoAthletes(fakePrisma([], new Map()), dataset(), {
      target: "development",
      withUsers: true,
      userPasswordHash: "athlete123",
    }),
    /bcrypt password hash/i,
  );
});

test("is idempotent and reports an existing synthetic athlete as updated", async () => {
  const existing = new Map([
    [
      `demo-athlete@${DEMO_EMAIL_DOMAIN}`,
      {
        id: "existing-athlete",
        dossier: {
          data: {
            demoMetadata: {
              synthetic: true,
              dataset: "fs-pilot-2026-08",
            },
          },
        },
      },
    ],
  ]);
  const calls: string[] = [];

  const result = await importDemoAthletes(
    fakePrisma(calls, existing),
    dataset(),
    {
      target: "development",
    },
  );

  assert.deepEqual(result, { created: 0, updated: 1, users: 0, total: 1 });
});

test("refuses to overwrite an unmarked record even on the reserved domain", async () => {
  const existing = new Map([
    [
      `demo-athlete@${DEMO_EMAIL_DOMAIN}`,
      { id: "unmarked-athlete", dossier: { data: {} } },
    ],
  ]);

  await assert.rejects(
    importDemoAthletes(fakePrisma([], existing), dataset(), {
      target: "development",
    }),
    /not marked as synthetic/i,
  );
});

test("does not allow the importer to target production", async () => {
  await assert.rejects(
    importDemoAthletes(fakePrisma([], new Map()), dataset(), {
      target: "production" as "development",
    }),
    /local, development or staging/i,
  );
});

test("imports into staging, the Railway environment the team actually uses", async () => {
  const result = await importDemoAthletes(
    fakePrisma([], new Map()),
    dataset(),
    { target: "staging" },
  );

  assert.equal(result.created, 1);
  assert.equal(result.total, 1);
});

function fakePrisma(
  calls: string[],
  existing: Map<string, { id: string; dossier?: { data: unknown } | null }>,
): DemoImportClient {
  const transactionClient = {
    organization: {
      upsert: async () => {
        calls.push("organization.upsert");
        return { id: "seed-org-001", name: "First Stringers" };
      },
    },
    athlete: {
      findUnique: async (args: Record<string, unknown>) => {
        calls.push("athlete.findUnique");
        const where = args.where as { email: string };
        return existing.get(where.email) ?? null;
      },
      upsert: async (args: Record<string, unknown>) => {
        calls.push("athlete.upsert");
        const where = args.where as { email: string };
        const previous = existing.get(where.email);
        return { id: previous?.id ?? `created-${where.email}` };
      },
    },
    dossier: {
      upsert: async () => {
        calls.push("dossier.upsert");
        return {};
      },
    },
    user: {
      upsert: async () => {
        calls.push("user.upsert");
        return {};
      },
    },
  };

  return {
    $transaction: async <T>(
      callback: (client: typeof transactionClient) => Promise<T>,
    ) => {
      calls.push("transaction");
      return callback(transactionClient);
    },
  };
}
