# Demo athlete datasets

This workflow creates synthetic athletes for First Stringers demos without using the general seed,
raw SQL, or shared athlete credentials. It writes only `Organization`, `Athlete`, and `Dossier`
records. It does not create `User`, `JerrySession`, recruiter, or conversation records — unless the
opt-in `--with-users` flag is passed, which additionally creates an ATHLETE login account per record
for demos that show the athlete-side Jerry experience.

The checked-in pilot contains three profiles:

- Marcus Johnson: proven 2027 quarterback with production, leadership, and strong academics.
- Elijah Brooks: underexposed 2028 safety/nickel prospect with verified athletic traits.
- Caleb Ramirez: developmental 2029 offensive lineman with length and elite academics.

## Safety model

- Dry-run and validation are the default; they do not instantiate Prisma or connect to a database.
- Database writes require both `--apply` and an explicit `--target=local|development`.
- Production is intentionally unsupported.
- A dataset is limited to 200 records and 5 MB.
- Every email must use `@demo.firststringers.test` and be unique.
- Every Dossier must include `demoMetadata.synthetic: true`.
- An existing record is updated only when its Dossier is already marked synthetic.
- All records must reach 100% using the product's current Dossier completeness fields.
- Keys that look like internal Jerry notes are rejected.
- Re-running the same dataset is idempotent because Athlete records are upserted by email.

## Commands

From `packages/database`:

```bash
# Validate the checked-in pilot. No database connection or writes.
pnpm demo:athletes

# Validate another generated batch.
pnpm demo:athletes -- --file=/absolute/path/to/demo-athletes.json

# Apply only after the dry-run and human review have passed.
pnpm demo:athletes -- --file=/absolute/path/to/demo-athletes.json --apply --target=development

# Also create ATHLETE login accounts (opt-in, for athlete-side Jerry demos).
pnpm demo:athletes -- --file=/absolute/path/to/demo-athletes.json --apply --target=development --with-users
```

## Adapting the detailed dossier source format

Use `demo_athlete_source_v1.json` as the source template when generating new sport batches. It
preserves the detailed athlete format while adding a small `first_stringers` block for product
decisions the adapter must not guess:

- canonical recruiter search position;
- scenario and advocacy score;
- trajectory and fit tags;
- athlete archetype and self-representation;
- non-negotiables and scholarship need.

The source must use the versioned envelope with `schema_version`, `dataset`, `generated_at`, and
`athletes`. A legacy top-level array is rejected with migration instructions.

From `packages/database`:

```bash
# Convert a source file to the strict canonical import format. No database access.
pnpm demo:athletes:adapt -- --file=/absolute/path/to/source.json --out=/absolute/path/to/canonical.json

# Validate the resulting canonical file. Still no database access.
pnpm demo:athletes -- --file=/absolute/path/to/canonical.json
```

The adapter refuses to replace an existing output file unless `--force` is explicit. It maps only
allowlisted fields and validates the result with the canonical importer. Date of birth, age, injury
history, surgery history, medical availability, and other health details are never copied into the
canonical Dossier; the command reports their field paths as excluded without logging their values.

Do not ask the model to produce those sensitive fields. The adapter recognizes them only so that
older samples can be reviewed and safely excluded. This workflow requires no Prisma migration.

`--with-users` upserts a `User` per athlete (role `ATHLETE`, email verified, linked by `athleteId`).
The shared demo password comes from the `DEMO_ATHLETE_PASSWORD` environment variable and defaults to
`athlete123`. The password is bcrypt-hashed before it reaches the importer; re-running does not
rotate the password of an existing demo user. Because dataset validation restricts every email to
`@demo.firststringers.test`, the upsert can never touch a real user account.

The apply command uses `DATABASE_URL` from the invoking environment. Confirm the selected database
before running it. The importer does not require a Prisma migration.

## Generation workflow for 100–150 athletes

1. Treat `demo_athlete_source_v1.json` as the generation template.
2. Agree on a coverage matrix before generating records.
3. Generate batches of 20–25 athletes rather than one large response.
4. Save each response as JSON without Markdown fences.
5. Run `demo:athletes:adapt` to produce the canonical file.
6. Run the canonical importer in dry-run mode.
7. Review names, schools, narratives, statistics, and scenario distribution with a product owner.
8. Merge approved batches into the canonical dataset and run dry-run again.
9. Import the three-athlete pilot into development first and smoke-test Billy and Dossier rendering.
10. Import the larger dataset only after the pilot is accepted.

Suggested dimensions to distribute deliberately:

- Sport and position.
- Graduation class.
- State, region, and relocation openness.
- GPA and intended major.
- Proven, underexposed, developmental, comeback, multi-sport, and high-academic scenarios.
- Scholarship need and target competitive level.
- Recruiting readiness and trajectory.

Avoid creating 150 athletes with interchangeable stories. Every scenario should exist because it
supports a realistic recruiter demo or tests a meaningful Billy decision.

## Prompt for ChatGPT or Claude

Use this prompt together with `demo_athlete_source_v1.json` as an attached example:

```text
You are creating fictional athlete records exclusively for First Stringers product demos.

Return valid JSON only. Do not use Markdown fences, comments, trailing commas, or prose outside the
JSON. Follow exactly the schema and nesting in the attached demo_athlete_source_v1.json. Set
schema_version to 1 and use the provided dataset identifier in the source envelope.

Safety requirements:
- Every person, school, coach, achievement, statistic, and narrative must be fictional.
- Do not copy or closely imitate a real athlete.
- Do not include birth dates, phone numbers, street addresses, parent details, or private data.
- Do not include injury, surgery, medical, or health details.
- Athlete emails must be deterministic, unique, lowercase, and end in
  @demo.firststringers.test.
- Media URLs must use https://example.com/ with fictional slugs.
- Set demoMetadata.synthetic to true.
- Never include Jerry internal notes, chain-of-thought, hidden evaluation instructions, or secrets.

Quality requirements:
- Complete every field that exists in each reference Dossier section.
- Complete every field in first_stringers explicitly; never infer or omit product decisions.
- Keep top-level sport and position in the canonical search format requested in the coverage matrix.
- Keep facts internally consistent across identity, stats, narrative, recruiterPitch, fitTags, and
  recruiting direction.
- Use realistic but clearly synthetic statistics and measurements.
- Distinguish athletes by scenario, development curve, strengths, risks, academics, preferences,
  and readiness.
- Do not claim guarantees, certainty about future performance, or facts not present in the record.

Generate exactly [BATCH_SIZE] athletes for this coverage matrix:
[PASTE APPROVED COVERAGE MATRIX]

Dataset identifier: [DATASET_ID]
Generated date: [YYYY-MM-DD]
```

## Product smoke tests for the pilot

After a controlled development import, test these Billy requests:

1. “I need a 2027 quarterback from Florida with strong academics, varsity production, and
   leadership.” Expected: Marcus Johnson.
2. “I’m looking for an under-recruited defensive back in the Southeast with verified speed, ball
   production, and positional versatility.” Expected: Elijah Brooks.
3. “We can be patient with development. Find me a young offensive tackle with length, strong
   academics, and Division I upside.” Expected: Caleb Ramirez.
4. “Show me athletes with at least a 3.4 GPA who are open outside their home state.” Expected: all
   three.
5. “Find a high-academic athlete for an engineering school who does not need to play immediately.”
   Expected: Caleb Ramirez.

Also open each recruiter-facing Dossier and verify that synthetic metadata and internal workflow
details are not presented as athlete content.
