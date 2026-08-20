import assert from "node:assert/strict";
import test from "node:test";
import { adaptDemoAthleteSourceDataset } from "../demo-athlete-source-adapter";
import { validateDemoAthleteDataset } from "../demo-athlete-importer";

function validSourceAthlete() {
  return {
    demo_id: "FS-DEMO-FB-001",
    demo_label: "DEMO ATHLETE — FICTIONAL PROFILE",
    identity: {
      full_name: "Marcus Demo Johnson",
      preferred_name: "Marcus",
      sport: "Football",
      primary_position: "Quarterback",
      secondary_position: null,
      position_abbreviation: "QB",
      graduation_class: 2027,
      date_of_birth: "2009-03-14",
      age: 17,
      dominant_hand: "Right",
      nationality: "United States",
      email: "marcus.johnson@demo.firststringers.test",
    },
    school_and_location: {
      city: "Demo City",
      state: "Florida",
      country: "United States",
      high_school: "Demo High School",
      school_classification: "Florida Class 5A",
      current_team_level: "Varsity",
      head_coach: "Demo Head Coach",
      position_coach_or_coordinator: "Demo Position Coach",
    },
    physical_profile: {
      height: "6'3\"",
      weight_lbs: 205,
    },
    athletic_measurements: {
      forty_yard_dash_seconds: 4.71,
      vertical_jump_inches: 34,
    },
    statistics: {
      games_played: 12,
      passing_yards: 3284,
      team_record: "10-2",
      career_statistics: {
        career_passing_yards: 6427,
      },
    },
    sports_profile: {
      primary_strengths: ["Leadership", "Pocket awareness"],
      areas_for_growth: ["Deep-ball consistency"],
    },
    academics: {
      cumulative_gpa: 3.82,
      sat_score: 1240,
      intended_college_major: "Business Administration",
      ncaa_eligibility_status: "On track",
      academic_interests: ["Leadership"],
    },
    recruiting_goals: {
      target_college_level: "NCAA Division I",
      geographic_preference: "Southeast United States",
      open_to_national_opportunities: true,
    },
    objectives: {
      short_term: ["Lead the team"],
      long_term: ["Graduate with a business degree"],
    },
    character: {
      leadership: 10,
      coachability: 10,
      response_to_adversity: "Strong",
      observations: "Prepared, accountable, and composed after mistakes.",
    },
    availability: {
      current_health_status: "Fully healthy",
      current_injury: "None",
      previous_major_injuries: "Mild ankle sprain",
      surgery_history: "None",
      physical_restrictions: "None",
      cleared_for_participation: true,
      transfer_status: "Not transferring",
    },
    multimedia: {
      primary_highlight_film: "https://example.com/marcus-highlights",
      full_game_film_1: "https://example.com/marcus-game-1",
      training_film: "https://example.com/marcus-training",
      hudl_profile: "https://example.com/marcus-hudl",
    },
    verification: {
      date_of_birth: "Verified",
      medical_availability: "Self-reported",
      overall_verification_level: "High",
    },
    recruiting_activity: {
      decision_timeline: "After senior season",
    },
    representation_summary:
      "A productive, academically qualified fictional quarterback with strong leadership.",
    first_stringers: {
      search_position: "QB",
      scenario: "proven-prospect",
      advocacy_score: 0.94,
      trajectory: "IMPROVING",
      fit_tags: ["verified-production", "strong-academics"],
      archetype: "Proven field general",
      self_representation: "A prepared teammate who leads by example.",
      non_negotiables: ["Strong academic fit"],
      scholarship_need: true,
    },
  };
}

function sourceDataset() {
  return {
    schema_version: 1,
    dataset: "football-2026-08",
    generated_at: "2026-08-19",
    athletes: [validSourceAthlete()],
  };
}

test("adapts the versioned source format into the canonical demo dataset", () => {
  const result = adaptDemoAthleteSourceDataset(sourceDataset());

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.ok(result.dataset);
  assert.equal(result.dataset.athletes[0].position, "QB");
  assert.equal(result.dataset.athletes[0].scenario, "proven-prospect");
  assert.equal(
    result.dataset.athletes[0].dossier.performance.stats.career_passing_yards,
    6427,
  );

  const canonical = validateDemoAthleteDataset(result.dataset);
  assert.equal(canonical.valid, true, canonical.errors.join("\n"));
  assert.equal(canonical.athletes[0].completeness, 1);
});

test("excludes date-of-birth and medical detail fields from canonical output", () => {
  const result = adaptDemoAthleteSourceDataset(sourceDataset());
  const serialized = JSON.stringify(result.dataset);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.doesNotMatch(serialized, /2009-03-14|ankle sprain|surgery/i);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("identity.date_of_birth"),
    ),
  );
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("availability.previous_major_injuries"),
    ),
  );
});

test("does not invent First Stringers product decisions missing from the source export", () => {
  const source = sourceDataset();
  delete (source.athletes[0] as Record<string, unknown>).first_stringers;

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, false);
  assert.equal(result.dataset, undefined);
  assert.match(result.errors.join("\n"), /first_stringers/i);
  assert.match(result.errors.join("\n"), /scenario/i);
  assert.match(result.errors.join("\n"), /advocacy_score/i);
  assert.match(result.errors.join("\n"), /trajectory/i);
});

test("recognizes the current legacy array and returns migration instructions", () => {
  const result = adaptDemoAthleteSourceDataset([validSourceAthlete()]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /legacy array/i);
  assert.match(result.errors.join("\n"), /schema_version/i);
  assert.match(result.errors.join("\n"), /generated_at/i);
});

test("rejects non-demo emails before producing canonical data", () => {
  const source = sourceDataset();
  source.athletes[0].identity.email = "real-athlete@example.com";

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, false);
  assert.equal(result.dataset, undefined);
  assert.match(result.errors.join("\n"), /demo\.firststringers\.test/i);
});

test("does not interpret 'Not eligible' as NCAA eligible", () => {
  const source = sourceDataset();
  source.athletes[0].academics.ncaa_eligibility_status = "Not eligible";

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(
    result.dataset?.athletes[0].dossier.academic.ncaaEligibility,
    false,
  );
});

test("rejects an unknown transfer status instead of silently guessing", () => {
  const source = sourceDataset();
  source.athletes[0].availability.transfer_status = "Maybe later";

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /transfer_status/i);
});

test("rejects an unknown NCAA eligibility status instead of treating it as false", () => {
  const source = sourceDataset();
  source.athletes[0].academics.ncaa_eligibility_status = "Needs review";

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /ncaa_eligibility_status/i);
});

test("requires explicit synthetic identifiers on every source athlete", () => {
  const source = sourceDataset();
  source.athletes[0].demo_id = "ATHLETE-001";
  source.athletes[0].demo_label = "REAL ATHLETE";

  const result = adaptDemoAthleteSourceDataset(source);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /demo_id/i);
  assert.match(result.errors.join("\n"), /fictional profile/i);
});
