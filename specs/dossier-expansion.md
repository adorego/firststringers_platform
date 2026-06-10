# Spec: Dossier Expansion — From 4 Sections to 6

## Objective

Expand the DossierData model from 4 sections (14 fields) to 6 sections (~35 fields) to match the product vision defined in `Estructura de Onboarding.pdf`. The dossier is the core product — it must evolve from a basic data collection into a living intelligence briefing that represents the athlete.

**Who**: Athletes using Jerry to build their dossier; recruiters viewing dossiers via Billy/Scout (future).

**Why**: Current dossier covers only identity, performance, academic, and availability. Product vision requires two additional sections — Representation Assets (visibility layer) and Competitive Identity (human signals). Several existing sections also need more fields to match the onboarding structure.

**Success looks like**: An athlete can have a conversation with Jerry that covers all 6 onboarding sections, the extracted data persists correctly in PostgreSQL, the frontend displays all sections, and completeness reflects the expanded field set.

## Tech Stack

- **Backend**: NestJS 11, TypeScript strict, Prisma (PostgreSQL), BullMQ + Redis, OpenAI GPT-4o
- **Frontend**: Next.js 16, React 19, Tailwind v4, Zustand, socket.io-client
- **Shared types**: `apps/api/src/shared/types/index.ts` (source of truth), mirrored in `apps/web/src/stores/dossier-store.ts`

## Commands

```bash
# Dev
pnpm dev                          # All apps
cd apps/api && pnpm start:dev     # API only (port 3001)
cd apps/web && pnpm dev           # Web only (port 3000)

# Test
cd apps/api && pnpm test          # Jest unit tests
cd apps/api && pnpm test -- --watch

# Database
cd packages/database && pnpm db:generate   # Regenerate Prisma client
cd packages/database && pnpm db:push       # Push schema (no migration file)
cd packages/database && pnpm db:migrate    # Create migration

# Build
pnpm build                        # Build all
pnpm lint                         # Lint all
```

## Project Structure (files to touch)

```
apps/api/src/shared/types/index.ts          → DossierData interface (SOURCE OF TRUTH)
apps/api/src/shared/llm/llm.service.ts      → OpenAI extraction schemas per intent
apps/api/src/modules/jerry/
  validator.service.ts                       → Completeness fields (9 → 18)
  strategy-planner.service.ts               → FIELD_PRIORITY list + new intents
  prompt-builder.service.ts                  → System prompts for new strategies
  data-extractor.service.ts                 → May need updates for new intents
  conversation.worker.ts                    → Pipeline (no structural change expected)
apps/api/src/modules/dossier/
  dossier.worker.ts                         → calculateCompleteness() expansion
  dossier.service.ts                        → getSections() expansion (4 → 6)
apps/web/src/stores/dossier-store.ts        → DossierData type mirror
apps/web/src/app/(athlete)/dossier/page.tsx → UI sections (4 → 6)
apps/api/src/modules/jerry/__tests__/       → Update existing tests
```

## Data Model: New DossierData

### Current (4 sections, 14 fields)
```typescript
interface DossierData {
  identity?: { sport, position, nationality, graduationYear }
  performance?: { stats, leagueLevel, highlightUrls }
  academic?: { gpa, satAct, intendedMajor, ncaaEligibility }
  availability?: { transferPortal, preferredRegions, scholarshipNeed }
}
```

### Target (6 sections, ~35 fields)
```typescript
export interface DossierData {
  // Section 2: Athlete Identity — "Who is this athlete?"
  identity?: {
    sport?: string;
    position?: string;
    location?: string;              // NEW — city/state/country
    school?: string;                // NEW — current school
    club?: string;                  // NEW — club/team name
    competitiveLevel?: string;      // NEW — varsity/JV/club/travel
    graduationYear?: number;
    nationality?: string;
  };

  // Section 3: Athletic Snapshot — "What can this athlete do?"
  performance?: {
    stats?: Record<string, number>;
    leagueLevel?: string;
    physicalProfile?: {             // NEW — height/weight/speed etc.
      height?: string;
      weight?: string;
      speed?: string;
      vertical?: string;
    };
    strengths?: string[];           // NEW — top athletic strengths
    archetype?: string;             // NEW — player archetype ("power forward", "shutdown corner")
    highlightUrls?: string[];
  };

  // Section 3 continued: Academic
  academic?: {
    gpa?: number;
    satAct?: number;
    intendedMajor?: string;
    ncaaEligibility?: boolean;
    academicInterests?: string[];   // NEW — beyond just major
  };

  // Section 4: Recruiting Direction — "Where does this athlete want to go?"
  availability?: {
    transferPortal?: boolean;
    preferredRegions?: string[];
    scholarshipNeed?: boolean;
    timeline?: string;              // NEW — "immediate", "next year", "2027"
    competitiveLevelGoal?: string;  // NEW — D1/D2/D3/NAIA/JUCO target
    goals?: string[];               // NEW — recruiting goals in athlete's words
    limitations?: string[];         // NEW — injuries, academic, financial, geographic
  };

  // Section 5: Representation Assets — "How do we make this athlete visible?"
  media?: {                         // NEW SECTION
    highlightUrls?: string[];       // Moved from performance
    clipUrls?: string[];            // NEW — individual clips
    socialMedia?: {                 // NEW — social links
      instagram?: string;
      twitter?: string;
      hudl?: string;
      other?: string;
    };
    references?: string[];          // NEW — coach names, contacts
  };

  // Section 6: Competitive Identity & Growth Signals — "What makes this athlete different?"
  character?: {                     // NEW SECTION
    mentality?: string;             // NEW — competitive mindset description
    leadership?: string;            // NEW — leadership examples
    coachability?: string;          // NEW — how they respond to coaching
    resilience?: string;            // NEW — adversity examples
    motivation?: string;            // NEW — what drives them
    growthAreas?: string[];         // NEW — self-identified areas to improve
  };

  // Narrative (existing, kept as-is)
  narrative?: {
    story?: string;
    goals?: string;
    motivation?: string;
  };

  // Meta (existing, kept as-is)
  meta?: {
    lastUpdated?: string;
    version?: number;
  };
}
```

### Field mapping from product sections

| Product Section | Data Section | Fields |
|----------------|-------------|--------|
| Sec 1: Introduccion | N/A | Jerry behavior only, no stored data |
| Sec 2: Identidad del Atleta | `identity` | sport, position, location, school, club, competitiveLevel, graduationYear, nationality |
| Sec 3: Athletic Snapshot | `performance` + `academic` | stats, leagueLevel, physicalProfile, strengths, archetype, highlightUrls, gpa, satAct, intendedMajor, ncaaEligibility, academicInterests |
| Sec 4: Direccion de Reclutamiento | `availability` | transferPortal, preferredRegions, scholarshipNeed, timeline, competitiveLevelGoal, goals, limitations |
| Sec 5: Representation Assets | `media` | highlightUrls (moved), clipUrls, socialMedia, references |
| Sec 6: Competitive Identity | `character` | mentality, leadership, coachability, resilience, motivation, growthAreas |

## Intent Expansion

### Current intents (6)
`stats` | `academic` | `personal` | `availability` | `question` | `other`

### Target intents (9)
`stats` | `academic` | `personal` | `availability` | `media` | `character` | `recruiting` | `question` | `other`

New intents:
- **`media`** — athlete mentions highlights, clips, social media, references
- **`character`** — athlete talks about mentality, leadership, resilience, motivation
- **`recruiting`** — athlete discusses goals, timeline, target programs, limitations

Note: `availability` keeps existing meaning (transfer portal, regions, scholarship). `recruiting` covers the goal/direction aspects.

## Completeness Calculation

### Current: 9 fields → 75% threshold
### Target: 18 core fields → 75% threshold

**New core fields for completeness (18):**

| # | Section | Field | Current? |
|---|---------|-------|----------|
| 1 | identity | sport | YES |
| 2 | identity | position | YES |
| 3 | identity | graduationYear | YES |
| 4 | identity | location | NEW |
| 5 | identity | school | NEW |
| 6 | performance | stats | YES |
| 7 | performance | leagueLevel | YES |
| 8 | performance | strengths | NEW |
| 9 | academic | gpa | YES |
| 10 | academic | intendedMajor | YES |
| 11 | availability | transferPortal | YES |
| 12 | availability | preferredRegions | YES |
| 13 | availability | competitiveLevelGoal | NEW |
| 14 | availability | goals | NEW |
| 15 | media | highlightUrls | MOVED |
| 16 | media | socialMedia | NEW |
| 17 | character | mentality | NEW |
| 18 | character | motivation | NEW |

**Threshold**: narrative auto-generation triggers at 75% (14/18 fields).

## FIELD_PRIORITY (strategy planner order)

The order Jerry asks about fields, from most to least important:

```typescript
const FIELD_PRIORITY = [
  // Identity first (Section 2) — makes athlete searchable
  'sport',
  'position',
  'graduation year',
  'location',
  'school',
  // Athletic (Section 3) — builds recruiting value
  'stats',
  'league level',
  'strengths',
  // Academic (Section 3 cont.) — eligibility
  'GPA',
  'intended major',
  // Recruiting Direction (Section 4) — where they want to go
  'competitive level goal',
  'goals',
  'availability',
  'preferred regions',
  // Media (Section 5) — visibility
  'highlights',
  'social media',
  // Character (Section 6) — differentiation
  'mentality',
  'motivation',
];
```

## Code Style

Follow existing patterns exactly:

```typescript
// Type definition pattern (shared/types/index.ts)
export interface DossierData {
  identity?: {
    sport?: string;
    // all fields optional — progressive collection
  };
}

// Validator pattern (validator.service.ts)
if (!data.identity?.sport) missing.push('sport');
if (!data.character?.mentality) missing.push('mentality');

// Extraction schema pattern (llm.service.ts)
character: {
  type: 'object',
  properties: {
    character: {
      type: 'object',
      properties: {
        mentality: { type: 'string' },
        leadership: { type: 'string' },
      },
    },
  },
},

// Frontend section pattern (dossier/page.tsx)
toSection("Competitive Identity", [
  { label: "Mentality", value: character.mentality ?? null },
  { label: "Leadership", value: character.leadership ?? null },
]),
```

## Testing Strategy

- **Framework**: Jest + @nestjs/testing
- **Location**: `apps/api/src/modules/jerry/__tests__/`
- **What to test**:
  - ValidatorService: new fields in `calculateMissingFields()` and `getAllRequiredFields()`
  - DossierWorker: `calculateCompleteness()` with 18 fields
  - StrategyPlannerService: new FIELD_PRIORITY ordering
  - LLMService: new schemas for `media`, `character`, `recruiting` intents
  - DossierService: `getSections()` returns 6 sections
- **Mock**: Redis, Prisma, OpenAI (always)
- **Coverage goal**: 80% on modified files

## Boundaries

**Always:**
- Run `pnpm test` in apps/api before considering done
- Run `pnpm build` to verify no type errors
- Keep all DossierData fields optional (progressive collection)
- Maintain backwards compatibility (existing dossiers must render)
- Update BOTH backend types AND frontend store types

**Ask first:**
- Prisma schema changes (if needed beyond JSON blob)
- Adding new npm dependencies
- Changing WebSocket event payloads

**Never:**
- Remove existing fields from DossierData
- Change the pipeline order in conversation.worker.ts
- Break existing tests
- Use `any` in TypeScript

## Success Criteria

1. `DossierData` interface has 6 data sections with ~35 fields
2. `JerryIntent` type includes 3 new intents: `media`, `character`, `recruiting`
3. LLM extraction schemas exist for all 9 intents
4. Validator checks 18 core fields for completeness
5. Strategy planner uses expanded FIELD_PRIORITY (18 fields)
6. DossierWorker calculates completeness against 18 fields
7. DossierService.getSections() returns 6 sections
8. Frontend dossier page renders 6 sections
9. Frontend dossier store mirrors the expanded DossierData type
10. All existing tests pass
11. New tests cover the expanded fields
12. `pnpm build` succeeds with no type errors
13. Existing dossiers with only 4 sections still render correctly

## Open Questions

None — all assumptions confirmed by the user.
