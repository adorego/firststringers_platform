# FS-CS-008 — Jerry–Billy Representation Contract

- **Version:** 0.2 Draft
- **Status:** Conceptually Approved with Modifications — Technical Approval Required
- **Classification:** Cognitive & Agent Interface Specification
- **Owner:** First Stringers
- **Product Approval:** Abel — conceptual approval recorded 2026-08-19
- **Technical Approval:** Andrés — pending
- **Depends On:** FS-CS-000, FS-CS-001, FS-CS-002, FS-CS-003, FS-CS-005, FS-CS-007

## Purpose

Define the controlled communication contract through which Billy may consult Jerry about an
athlete and Jerry may respond as that athlete's representative.

The contract exists to make personalized recruiting recommendations possible without weakening
athlete trust. It defines what Billy may request, what Jerry may disclose, how every statement is
grounded, what happens when information is unavailable, and how the interaction is audited.

This specification replaces the idea of a generic recruiter pitch with a contextual
**Representation Loop**:

1. A coach explains a recruiting objective to Billy.
2. Billy retrieves and ranks eligible athletes using structured recruiting data.
3. Billy consults Jerry only for candidates with a preliminary fit and a specific purpose.
4. Jerry evaluates the request from the athlete's perspective and under the sharing policy.
5. Jerry returns an authorized, grounded representation response.
6. If a useful answer is missing, Jerry creates a follow-up priority for the athlete.

## Success Definition

The contract succeeds when a coach receives a useful, personalized explanation of fit; the athlete
is represented accurately and only with authorized information; every claim can be traced to a
source; uncertainty is explicit; and the company can reconstruct who asked what, what Jerry
answered, which policy was applied, and what the interaction cost.

## Non-Goals

This version does not:

- allow Billy to read Jerry's raw conversation history;
- expose the Athlete Owner's Manual to recruiters;
- let either model decide access permissions;
- let Jerry accept an opportunity or make a decision for the athlete;
- create autonomous outbound contact with coaches;
- replace direct athlete consent where consent is required;
- support arbitrary free-form tools or model-to-model messages;
- implement the complete NCAA/recruiting compliance framework;
- let Jerry discover opportunities proactively or contact coaches autonomously in V1.

## Capability Map

| Module ID                 | Responsibility                                                                        | Depends On                                      |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `representation-contract` | Versioned request, response, claim and error structures                               | —                                               |
| `representation-policy`   | Authentication, authorization, consent, field classification and disclosure decisions | `representation-contract`                       |
| `representation-audit`    | Idempotency, interaction log, model usage, cost and latency                           | `representation-contract`                       |
| `representation-loop`     | Billy orchestration, Jerry response generation and athlete follow-up                  | `representation-policy`, `representation-audit` |
| `representation-evals`    | Contract, privacy, grounding, multi-turn and end-to-end verification                  | All prior modules                               |
| `recruiting-compliance`   | Pre-Beta extension point for deterministic recruiting restrictions                    | `representation-policy`                         |

**Build order:** contract → policy and audit → loop → evaluations.

## Operating Principles

1. **Jerry represents the athlete.** A coach request never changes Jerry's loyalty.
2. **Purpose before disclosure.** Billy must state the recruiting objective and why each category
   of information is requested.
3. **Minimum necessary information.** Jerry shares only the smallest authorized set of facts needed
   to answer the request.
4. **Code enforces access.** System prompts may explain policy, but models never grant permission.
5. **Claims, not prose, are the source of truth.** Human-readable text is generated only from an
   allowlisted set of structured claims.
6. **Unknown remains unknown.** Missing information is never replaced with inference or optimism.
7. **Every interaction is attributable.** Requests, decisions, responses and costs are auditable.
8. **Representation improves through questions.** A useful unknown may become an athlete follow-up,
   but it is not disclosed until answered and authorized.
9. **Knowing, using and disclosing are separate decisions.** A fact Jerry knows is not automatically
   available to Billy, usable for fit, or revealable to a recruiter.
10. **Silence is never consent.** Authorization must be explicit, revocable, auditable and tied to
    a defined category or opportunity when required.

## Trust Boundaries and Abuse Cases

The browser, recruiter text, athlete text, WebSocket payloads and model output are untrusted.
Database identifiers received from a browser are selectors, not proof of authorization.

The implementation must prevent at least these abuse cases:

- a recruiter bypasses structured retrieval/ranking and requests Jerry without a preliminary fit;
- an unverified recruiter calls the Jerry interaction event directly;
- a recruiter asks Billy to reveal private Owner's Manual insights;
- prompt injection asks Jerry to ignore consent or disclose raw conversations;
- a model invents a claim not present in the authorized fact bundle;
- retries create duplicate charges, duplicate follow-up questions or conflicting audit records;
- cached content created for one recruiter or purpose is returned to another;
- an error reveals whether a private fact exists.

## Request Contract

Billy does not send raw chat history to Jerry. Billy sends a bounded representation request after
the recruiter has provided enough context.

```ts
type RepresentationQueryType =
  | "FIT"
  | "FACT_OR_ELIGIBILITY"
  | "PREFERENCE"
  | "VERIFICATION"
  | "MISSING_INFORMATION"
  | "OPPORTUNITY_READINESS"
  | "INTRODUCTION_READINESS";

type RecruitingIntentStage =
  | "DISCOVERY"
  | "EVALUATION"
  | "ACTIVE_INTEREST"
  | "INTRODUCTION_REQUESTED";

interface JerryRepresentationRequestV1 {
  contractVersion: "1.0";
  requestId: string;
  recruiterId: string;
  billyConversationId: string;
  athleteId: string;
  opportunityId?: string;
  recruitingObjective: string;
  question: string;
  queryType: RepresentationQueryType;
  intentStage: RecruitingIntentStage;
  requestedFields: string[];
  purpose:
    | "ATHLETE_RECOMMENDATION"
    | "FIT_CLARIFICATION"
    | "OPPORTUNITY_REVIEW";
  createdAt: string;
}
```

### Server-derived fields

The server, never the browser or model, derives and verifies:

- `requestId` and `contractVersion`;
- `recruiterId` from the authenticated JWT;
- `billyConversationId` ownership;
- `athleteId` eligibility for representation;
- `opportunityId`, when opportunity-specific consent or identity rules apply;
- `intentStage` from the server-owned recruiting interaction state;
- `createdAt`;
- the final allowlist of `requestedFields`.

The browser may provide the natural-language question, recruiting objective, selected athlete and
query type. Every field has a size limit and enum validation at the boundary.

### Consultation eligibility

An athlete does **not** need to be in a recruiter's pipeline before Billy consults Jerry. Billy
must first perform normal structured retrieval and ranking. A representation request is eligible
only when all of these are true:

1. the recruiting intent is defined;
2. the athlete is eligible for representation;
3. structured data indicates a preliminary fit;
4. the request has a specific recruiting purpose;
5. the applicable use and disclosure permissions can be evaluated.

For the MVP, `FIT`, `FACT_OR_ELIGIBILITY`, `PREFERENCE`, `VERIFICATION` and
`MISSING_INFORMATION` are the prioritized query types. `OPPORTUNITY_READINESS` and
`INTRODUCTION_READINESS` remain intentionally simple until post-MVP workflows are approved.

## Claim Contract

Jerry's prose may only use claims and non-revealing representation signals approved by the policy
layer. Athlete Knowledge, representation use and disclosure are distinct policy decisions.

```ts
type ClaimProvenance =
  | "ATHLETE_DECLARED"
  | "TRUSTED_SOURCE_VERIFIED"
  | "PLATFORM_VERIFIED";

type ClaimVerification = "DECLARED" | "VERIFIED" | "NOT_CONFIRMED";

type InformationHandlingLevel =
  | "RECRUITING_PUBLIC"
  | "AUTHORIZED_REPRESENTATION"
  | "CONTROLLED_DISCLOSURE"
  | "PRIVATE";

interface AthleteKnowledgeFactV1 {
  fieldPath: string;
  value: string | number | boolean | string[];
  provenance: ClaimProvenance;
  verification: ClaimVerification;
  handling: InformationHandlingLevel;
  sourceRecordedAt: string;
  lastConfirmedAt?: string;
  permissionId?: string;
  freshness: "CURRENT" | "RECONFIRMATION_DUE" | "STALE";
}

interface RepresentationClaimV1 {
  fieldPath: string;
  value: string | number | boolean | string[];
  provenance: ClaimProvenance;
  verification: ClaimVerification;
  handling: "RECRUITING_PUBLIC" | "CONTROLLED_DISCLOSURE";
  sourceRecordedAt: string;
  lastConfirmedAt?: string;
  disclosureAuthorizationId?: string;
}

interface RepresentationSignalV1 {
  code: string;
  statement: string;
  basisFieldPaths: string[];
  authorizationId: string;
  revealsProtectedValue: false;
}
```

The four handling levels mean:

| Level                       | Jerry may know it                        | May inform representation                | Raw value may be disclosed to Billy/recruiter |
| --------------------------- | ---------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| `RECRUITING_PUBLIC`         | Yes                                      | Yes                                      | Yes                                           |
| `AUTHORIZED_REPRESENTATION` | Yes                                      | Yes, as an approved non-revealing signal | No                                            |
| `CONTROLLED_DISCLOSURE`     | Yes                                      | Only within the authorized purpose       | Only with applicable explicit consent         |
| `PRIVATE`                   | Yes, inside Jerry's private relationship | No recruiter-facing use                  | Never                                         |

`AUTHORIZED_REPRESENTATION` is not a disguised disclosure channel. Deterministic policy code must
construct a bounded `RepresentationSignalV1` that does not reveal, narrow down or confirm the
protected value. Raw facts at this level never enter Billy's or the recruiter-facing model's
prompt.

Inferred information is not a shareable provenance type. If a model infers a potentially useful
fact, it may create an internal follow-up suggestion, but it cannot become a recruiter-facing
claim until the athlete or a trusted source confirms it.

## Response Contract

The response is a discriminated union. Consumers must handle every status explicitly.

```ts
type RepresentationResponseStatus =
  | "ANSWERED"
  | "PARTIAL"
  | "NOT_CONFIRMED"
  | "CONSENT_REQUIRED"
  | "FORBIDDEN"
  | "UNAVAILABLE";

interface JerryRepresentationResponseV1 {
  contractVersion: "1.0";
  requestId: string;
  status: RepresentationResponseStatus;
  athleteId: string;
  presentation: string;
  claims: RepresentationClaimV1[];
  representationSignals: RepresentationSignalV1[];
  unknowns: string[];
  followUp?: {
    isNeeded: boolean;
    questionId?: string;
    topic?: string;
  };
  policyDecision: {
    sharedFieldPaths: string[];
    withheldFieldPaths: string[];
    appliedAuthorizationIds: string[];
    reasonCodes: string[];
  };
  generatedAt: string;
}
```

### Status semantics

| Status             | Meaning                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `ANSWERED`         | The authorized claims sufficiently answer the question.                                                                |
| `PARTIAL`          | Jerry can answer part of the question and names the remaining uncertainty.                                             |
| `NOT_CONFIRMED`    | No authorized confirmed information answers the question. A follow-up may be created.                                  |
| `CONSENT_REQUIRED` | Relevant information cannot be shared without athlete authorization. The response does not reveal the protected value. |
| `FORBIDDEN`        | The request query type or purpose is not permitted.                                                                    |
| `UNAVAILABLE`      | The service could not complete the request safely. No speculative answer is returned.                                  |

`presentation` must remain useful but may not contradict the structured status, claims, unknowns or
policy decision.

## Information Classification

All athlete information must have an explicit handling level before it can enter the policy
pipeline. The implementation uses a server-owned allowlist; absence from the allowlist means
`PRIVATE`. The policy layer separately decides whether a fact may be used and whether its raw value
may be disclosed for the current purpose.

### Proposed MVP defaults

| Information                                                                | Default                     |
| -------------------------------------------------------------------------- | --------------------------- |
| Sport, position, graduation year, school, competitive level                | `RECRUITING_PUBLIC`         |
| Athlete-approved stats, verified metrics and published highlights          | `RECRUITING_PUBLIC`         |
| General target level, timeline and preferred regions                       | `AUTHORIZED_REPRESENTATION` |
| GPA, scholarship need, relocation constraints and references               | `CONTROLLED_DISCLOSURE`     |
| Health details, family information, private limitations and support system | `PRIVATE`                   |
| Owner's Manual, raw Jerry conversations and private notes                  | `PRIVATE`                   |

These defaults are product direction, not permission to ship an incomplete policy. Until the
allowlist, consent checks and safe signal templates are implemented and technically approved, the
system withholds the field.

## Consent Model

Consent is explicit, revocable, auditable and contextual. It is evaluated in deterministic code
before any protected value enters an LLM prompt.

| Consent layer                   | What it authorizes                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Standing Representation Consent | Jerry acting as the athlete's representative under the approved operating rules      |
| Category-Level Consent          | Use or disclosure of a defined information category for approved recruiting purposes |
| Opportunity-Specific Consent    | Use or disclosure for one identified opportunity, program or introduction            |

Rules:

- silence, inactivity and an unanswered question never count as consent;
- consent records include athlete, scope, purpose, grant time, source and revocation state;
- revocation takes effect before the next response and invalidates affected cached responses;
- a repeated conversational preference does not become a permanent permission until Jerry asks
  the athlete to confirm it;
- opportunity-specific consent cannot be reused for another recruiter, program or opportunity;
- policy may require both category-level and opportunity-specific consent;
- the model may explain or request consent, but only server-side policy may grant access.

## Recruiting Intent and Program Identity

The amount of identity Jerry may reveal to the athlete depends on the server-owned intent stage:

| Stage                    | Identity behavior                                                              |
| ------------------------ | ------------------------------------------------------------------------------ |
| `DISCOVERY`              | Do not reveal a coach or program identity                                      |
| `EVALUATION`             | Jerry may describe a relevant inquiry; program identity is not required        |
| `ACTIVE_INTEREST`        | Reveal identity when it is needed for an informed response or consent decision |
| `INTRODUCTION_REQUESTED` | Reveal identity before asking the athlete to approve an introduction           |

A search result, profile view or exploratory question is not confirmed interest. The platform,
not a model phrase, advances the intent stage.

## Authorization Rules

Before Jerry receives any athlete data, the policy layer must confirm:

1. The request is authenticated as a recruiter.
2. The JWT recruiter owns `billyConversationId`.
3. The recruiter has `verificationStatus = verified`.
4. The athlete exists and has `representationStatus` of `represented` or `verified`.
5. The query type and purpose are allowlisted.
6. Every requested field is permitted for that purpose.
7. Required athlete consent exists and has not expired or been revoked.
8. Structured retrieval established preliminary fit; prior pipeline membership is not required.

Failure is deny-by-default. The model never sees fields that fail policy.

## Grounding and Response Generation

The response pipeline is mandatory:

1. Load the athlete's current dossier version.
2. Apply authorization, representation-use and disclosure policy in deterministic code.
3. Build the minimum authorized claim and non-revealing signal bundle.
4. Give the response model only the recruiting objective, question, authorized claims and safe
   representation signals.
5. Parse the model output as structured data.
6. Validate that every generated claim matches the allowlisted bundle.
7. Reject or safely regenerate if prose adds unsupported facts, promises, pressure or hidden data.
8. Record the policy decision, response and usage before delivery.

Jerry must not:

- invent, upgrade or combine facts into an unsupported conclusion;
- promise scholarships, roster spots, exposure or outcomes;
- create urgency such as "act quickly" unless an athlete-authorized factual deadline exists;
- reveal private information or indicate that a private fact exists;
- describe an athlete as a fit without naming the known basis and remaining uncertainty;
- rank the athlete's worth.

## Missing Information and Athlete Follow-Up

When the answer would materially improve representation but is unknown:

1. Jerry returns `NOT_CONFIRMED` or `PARTIAL`.
2. The system creates one deduplicated pending athlete question linked to `requestId`.
3. Jerry asks the athlete naturally in the athlete experience; the recruiter does not gain access
   to Jerry's private conversation.
4. The athlete's response enters the normal extraction, verification and consent process.
5. The original request may be resolved only after the new claim is authorized.

A recruiter is never promised that the athlete will answer or that the answer will be shared.

Pending questions use one of four explicit states:

- `PENDING` — Jerry still needs an athlete response;
- `ANSWERED` — the athlete supplied an answer, which still passes verification and policy;
- `DECLINED` — the athlete chose not to answer;
- `NO_LONGER_RELEVANT` — the underlying opportunity or question no longer requires an answer.

`DECLINED` is a valid terminal state and must not be converted into repeated pressure.

## Memory Domains and Freshness

The implementation separates four memory domains:

1. **Athlete Knowledge** — structured facts Jerry may reason about under their handling policy.
2. **Private Conversation History** — raw athlete/Jerry dialogue; Billy never receives it.
3. **Recruiting Activity / Billy Memory** — recruiter objectives, interaction state and permitted
   representation outcomes.
4. **Audit History** — immutable-enough operational evidence of requests, policy and delivery.

Each Athlete Knowledge fact records its source, confirmation date, verification status, permission
reference and freshness. Facts marked `RECONFIRMATION_DUE` or `STALE` cannot be silently presented
as current. They either produce qualified uncertainty or a deduplicated follow-up.

This specification does not invent permanent retention periods. Privacy, Legal and Compliance must
approve retention, deletion and export rules for every memory domain before Beta. The MVP must
minimize stored values and must not copy private conversation content into recruiting or telemetry
stores.

## Audit, Idempotency and Cost

Every request must create an auditable interaction record containing:

- request ID, contract version and request hash;
- recruiter, Billy conversation and athlete IDs;
- query type, purpose, intent stage and requested field paths;
- policy result and reason codes;
- shared and withheld field paths, but not unnecessary private values;
- response status, claim references and generated presentation;
- model/provider/version, prompt and completion tokens, estimated cost and latency;
- dossier version and policy version used;
- timestamps and terminal processing state.

`requestId` is an idempotency key. It is claimed atomically with a unique constraint. A retry with
the same request hash returns the recorded result. Reusing the ID with a different payload fails.
An in-flight duplicate returns a deliberate pending/conflict result; it never starts a second model
call or follow-up question.

Audit records must have an approved retention period and deletion/export behavior before Beta.
Logs and telemetry must not contain raw Owner's Manual data or private conversation history.

## Caching Rules

A generic athlete pitch is not a valid cache for this contract because the response depends on the
coach objective, question, authorization and current athlete data.

A response may only be reused when all of these match:

- normalized request hash;
- recruiter authorization context;
- athlete dossier version;
- consent and policy version;
- contract version.

Revoked consent or updated athlete information invalidates the cached response.

## Recruiting Compliance Extension (Pre-Beta)

NCAA and broader recruiting compliance are not MVP blockers, but the architecture must preserve a
deterministic policy extension. Before Beta, First Stringers will define a separate Recruiting
Compliance Framework with decision statuses such as:

- `ALLOWED`;
- `RESTRICTED`;
- `CONDITIONAL`;
- `REVIEW_REQUIRED`.

Compliance restricts the prohibited action or disclosure rather than disabling the entire
representation workflow. An LLM may explain a policy decision but never makes the authoritative
compliance determination. V1 includes no autonomous coach outreach; future proactive opportunity
discovery by Jerry must pass this policy boundary before any action is taken.

## Errors

Internal failures use stable machine-readable codes and safe user messages. Stack traces, policy
internals and private field names never reach the recruiter.

Required error codes include:

- `REPRESENTATION_INVALID_REQUEST`;
- `REPRESENTATION_UNAUTHENTICATED`;
- `REPRESENTATION_FORBIDDEN`;
- `REPRESENTATION_ATHLETE_NOT_ELIGIBLE`;
- `REPRESENTATION_CONSENT_REQUIRED`;
- `REPRESENTATION_CONFLICT`;
- `REPRESENTATION_UNAVAILABLE`.

## Compatibility and Migration

The existing `contact_jerry` flow returns an unstructured, generic pitch. During implementation it
may be adapted behind the existing UI, but there must be one authoritative backend contract.

The temporary compatibility layer may map `presentation` to the current `jerry_pitch` UI event.
It must not bypass the new authorization, policy, grounding or audit pipeline. The old generic pitch
generation path is removed after the frontend consumes the structured response.

## Testing Strategy

### Contract tests

- Reject malformed versions, query types, intent stages, IDs, empty objectives and unknown fields.
- Verify every response status has the documented shape.
- Verify idempotent retries and payload mismatch conflicts.

### Authorization and privacy tests

- Reject unauthenticated and non-recruiter callers.
- Reject conversation ownership mismatches and unverified recruiters.
- Reject athletes below `represented`.
- Withhold private and controlled-disclosure fields without leaking their values or existence.
- Prove silence and repeated preferences do not create consent.
- Prove revoked and opportunity-mismatched consent denies disclosure.
- Confirm Owner's Manual and raw Jerry messages never enter prompts or responses.

### Grounding tests

- Every response claim exactly matches an authorized source claim.
- Representation signals never contain or narrow down a protected raw value.
- Unsupported model claims fail validation.
- Unknown information remains `NOT_CONFIRMED`.
- No scholarship promises, fabricated verification or artificial urgency.

### Loop and audit tests

- Missing useful information creates one deduplicated athlete follow-up.
- A resolved follow-up does not auto-share without policy approval.
- Every delivered response has one complete audit record with usage and latency.
- Retries do not create duplicate model calls, charges or questions.
- Billy cannot bypass structured retrieval and preliminary-fit eligibility.
- Search/profile views remain `DISCOVERY`; only platform events advance intent stage.
- Pending questions transition only among the four documented states.

### End-to-end scenario

Coach objective → Billy clarification → structured retrieval/ranking → preliminary represented
athlete match → Jerry request → authorized personalized response → unknown athlete follow-up →
athlete answer → dossier update → authorized resolution visible to Billy.

## Commands

```bash
cd apps/api && pnpm test -- --runInBand
cd apps/api && pnpm test:e2e -- --runInBand
pnpm build
pnpm lint
```

Agent evaluations that call a real model must be run deliberately and recorded as a versioned
report. A single release candidate must pass Jerry, Billy and cross-agent suites together.

## Implementation Boundaries

### Always

- Validate at WebSocket/HTTP boundaries.
- Derive identity and authorization context on the server.
- Apply knowledge, representation-use, consent and disclosure policy before any LLM prompt.
- Treat model output as untrusted and validate it against authorized claims.
- Use additive, versioned types and stable error codes.
- Record usage, cost, policy and audit data for each delivered response.

### Ask First

- Final field handling allowlist and consent UX.
- Approved templates for non-revealing representation signals.
- Database retention and deletion periods.
- New dependencies, model/provider changes or external integrations.
- Whether athlete follow-ups identify the requesting coach or program.
- Any autonomous outbound communication.

### Never

- Put raw Owner's Manual content or private Jerry messages in Billy's context.
- Let prompts, models or clients grant data access.
- Share inferred, unconfirmed or unauthorized claims.
- Trust a browser-provided recruiter identity.
- Retry a model call without idempotency protection.
- Silently fall back to the legacy generic pitch after a policy or grounding failure.

## Success Criteria

The specification is implementation-ready when Andrés and Abel approve these statements:

1. Every request and response uses the versioned contract defined here.
2. Recruiter and conversation identity are server-derived and ownership-checked.
3. Only verified recruiters may consult Jerry.
4. Only represented or verified athletes may be queried.
5. Every disclosed claim has provenance, verification and a handling level.
6. The Owner's Manual and raw Jerry conversations remain private.
7. Controlled fields cannot be disclosed without auditable, contextual athlete authorization.
8. Unknown information returns an explicit non-confirmed state without inference.
9. Missing useful information creates at most one deduplicated athlete follow-up.
10. Human-readable responses are validated against structured authorized claims.
11. Every request is idempotent and has one complete audit record.
12. Token usage, estimated cost and latency are captured.
13. Generic cached pitches cannot bypass context or policy.
14. Unit, contract, privacy, grounding and end-to-end tests pass.
15. One full cross-agent evaluation report passes the approved thresholds.
16. Billy consults Jerry only after structured retrieval establishes preliminary fit; pipeline
    membership is not required.
17. Intent stage governs program identity and cannot be advanced by model language alone.
18. Authorized representation signals cannot reveal or confirm protected raw values.

## Technical Confirmations Required Before Implementation

1. Andrés confirms the versioned request/response structures and server-owned intent state fit the
   current architecture.
2. The team confirms the exact MVP field allowlist and safe representation-signal templates before
   enabling the loop.
3. The team confirms consent persistence, revocation and cache invalidation mechanics.
4. Privacy, Legal and Compliance define memory retention, deletion and export periods before Beta.
5. The Recruiting Compliance Framework is documented as a separate Pre-Beta specification.

## Changelog

- **0.2 Draft (2026-08-19)** — Incorporated Abel's conceptual approval and required modifications:
  separated knowledge/use/disclosure, defined layered consent, introduced recruiting intent stages,
  formalized memory and pending-question states, removed pipeline membership as a prerequisite,
  adopted the official query types and reserved a deterministic Pre-Beta compliance extension.
- **0.1 Draft (2026-08-16)** — Initial contract proposal derived from the executive Jerry–Billy
  presentation, the current platform implementation, and Trello card 38w7uQKw.
