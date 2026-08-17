# FS-CS-008 — Jerry–Billy Representation Contract

- **Version:** 0.1 Draft
- **Status:** Proposed — Product Approval Required
- **Classification:** Cognitive & Agent Interface Specification
- **Owner:** First Stringers
- **Product Approval:** Abel
- **Technical Approval:** Andrés
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
2. Billy identifies a represented athlete who may fit.
3. Billy sends Jerry a specific, purpose-bound representation request.
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
- support arbitrary free-form tools or model-to-model messages.

## Capability Map

| Module ID                 | Responsibility                                                                        | Depends On                                      |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `representation-contract` | Versioned request, response, claim and error structures                               | —                                               |
| `representation-policy`   | Authentication, authorization, consent, field classification and disclosure decisions | `representation-contract`                       |
| `representation-audit`    | Idempotency, interaction log, model usage, cost and latency                           | `representation-contract`                       |
| `representation-loop`     | Billy orchestration, Jerry response generation and athlete follow-up                  | `representation-policy`, `representation-audit` |
| `representation-evals`    | Contract, privacy, grounding, multi-turn and end-to-end verification                  | All prior modules                               |

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

## Trust Boundaries and Abuse Cases

The browser, recruiter text, athlete text, WebSocket payloads and model output are untrusted.
Database identifiers received from a browser are selectors, not proof of authorization.

The implementation must prevent at least these abuse cases:

- a recruiter requests a pitch for an athlete they did not discover through an authorized flow;
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
type RepresentationQuestionCategory =
  | "RECRUITING_FIT"
  | "ATHLETIC_PROFILE"
  | "ACADEMIC_FIT"
  | "CHARACTER_AND_LEADERSHIP"
  | "AVAILABILITY_AND_TIMELINE"
  | "MEDIA_AND_REFERENCES"
  | "OPPORTUNITY_ALIGNMENT";

interface JerryRepresentationRequestV1 {
  contractVersion: "1.0";
  requestId: string;
  recruiterId: string;
  billyConversationId: string;
  athleteId: string;
  recruitingObjective: string;
  question: string;
  category: RepresentationQuestionCategory;
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
- `createdAt`;
- the final allowlist of `requestedFields`.

The browser may provide the natural-language question, recruiting objective, selected athlete and
category. Every field has a size limit and enum validation at the boundary.

## Claim Contract

Jerry's prose may only use claims approved by the policy layer.

```ts
type ClaimProvenance =
  | "ATHLETE_DECLARED"
  | "TRUSTED_SOURCE_VERIFIED"
  | "PLATFORM_VERIFIED";

type ClaimVerification = "DECLARED" | "VERIFIED" | "NOT_CONFIRMED";

type SharingClassification =
  | "PUBLIC_RECRUITING"
  | "RECRUITING_ALLOWED"
  | "CONSENT_REQUIRED"
  | "PRIVATE";

interface RepresentationClaimV1 {
  fieldPath: string;
  value: string | number | boolean | string[];
  provenance: ClaimProvenance;
  verification: ClaimVerification;
  sharing: Exclude<SharingClassification, "PRIVATE">;
  sourceRecordedAt: string;
  lastConfirmedAt?: string;
}
```

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
  unknowns: string[];
  followUp?: {
    isNeeded: boolean;
    questionId?: string;
    topic?: string;
  };
  policyDecision: {
    sharedFieldPaths: string[];
    withheldFieldPaths: string[];
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
| `FORBIDDEN`        | The request category or purpose is not permitted.                                                                      |
| `UNAVAILABLE`      | The service could not complete the request safely. No speculative answer is returned.                                  |

`presentation` must remain useful but may not contradict the structured status, claims, unknowns or
policy decision.

## Information Classification

All athlete information must have an explicit classification before it can enter the claim bundle.
The implementation uses a server-owned allowlist; absence from the allowlist means `PRIVATE`.

### Proposed MVP defaults

| Information                                                                | Default              |
| -------------------------------------------------------------------------- | -------------------- |
| Sport, position, graduation year, school, competitive level                | `PUBLIC_RECRUITING`  |
| Verified athletic metrics, athlete-approved stats, highlights              | `RECRUITING_ALLOWED` |
| General target level, timeline and preferred regions                       | `RECRUITING_ALLOWED` |
| GPA, scholarship need, relocation constraints and references               | `CONSENT_REQUIRED`   |
| Health details, family information, private limitations and support system | `PRIVATE`            |
| Owner's Manual, raw Jerry conversations and private notes                  | `PRIVATE`            |

These defaults require Abel's product approval. Until approved and implemented, the system must
default to withholding the field.

## Authorization Rules

Before Jerry receives any athlete data, the policy layer must confirm:

1. The request is authenticated as a recruiter.
2. The JWT recruiter owns `billyConversationId`.
3. The recruiter has `verificationStatus = verified`.
4. The athlete exists and has `representationStatus` of `represented` or `verified`.
5. The category and purpose are allowlisted.
6. Every requested field is permitted for that purpose.
7. Required athlete consent exists and has not expired or been revoked.

Failure is deny-by-default. The model never sees fields that fail policy.

## Grounding and Response Generation

The response pipeline is mandatory:

1. Load the athlete's current dossier version.
2. Apply authorization and sharing policy in deterministic code.
3. Build the minimum authorized claim bundle.
4. Give Jerry only the recruiting objective, question and authorized claims.
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

## Audit, Idempotency and Cost

Every request must create an auditable interaction record containing:

- request ID, contract version and request hash;
- recruiter, Billy conversation and athlete IDs;
- category, purpose and requested field paths;
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

Audit records must have an approved retention period and deletion/export behavior before launch.
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

- Reject malformed versions, categories, IDs, empty objectives and unknown requested fields.
- Verify every response status has the documented shape.
- Verify idempotent retries and payload mismatch conflicts.

### Authorization and privacy tests

- Reject unauthenticated and non-recruiter callers.
- Reject conversation ownership mismatches and unverified recruiters.
- Reject athletes below `represented`.
- Withhold private and consent-required fields without leaking their values or existence.
- Confirm Owner's Manual and raw Jerry messages never enter prompts or responses.

### Grounding tests

- Every response claim exactly matches an authorized source claim.
- Unsupported model claims fail validation.
- Unknown information remains `NOT_CONFIRMED`.
- No scholarship promises, fabricated verification or artificial urgency.

### Loop and audit tests

- Missing useful information creates one deduplicated athlete follow-up.
- A resolved follow-up does not auto-share without policy approval.
- Every delivered response has one complete audit record with usage and latency.
- Retries do not create duplicate model calls, charges or questions.

### End-to-end scenario

Coach objective → Billy clarification → represented athlete match → Jerry request → authorized
personalized response → unknown athlete follow-up → athlete answer → dossier update → authorized
resolution visible to Billy.

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
- Apply field policy before constructing any LLM prompt.
- Treat model output as untrusted and validate it against authorized claims.
- Use additive, versioned types and stable error codes.
- Record usage, cost, policy and audit data for each delivered response.

### Ask First

- Final field classification and consent UX.
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
5. Every disclosed claim has provenance, verification and sharing classification.
6. The Owner's Manual and raw Jerry conversations remain private.
7. Consent-required fields cannot be disclosed without auditable athlete authorization.
8. Unknown information returns an explicit non-confirmed state without inference.
9. Missing useful information creates at most one deduplicated athlete follow-up.
10. Human-readable responses are validated against structured authorized claims.
11. Every request is idempotent and has one complete audit record.
12. Token usage, estimated cost and latency are captured.
13. Generic cached pitches cannot bypass context or policy.
14. Unit, contract, privacy, grounding and end-to-end tests pass.
15. One full cross-agent evaluation report passes the approved thresholds.

## Product Decisions Required Before Implementation

1. Approve or change the proposed MVP field-classification table.
2. Define how and when athletes authorize `CONSENT_REQUIRED` fields.
3. Define consent expiration and revocation behavior.
4. Decide whether follow-up questions identify the coach/program to the athlete.
5. Approve audit, cache and pending-question retention periods.
6. Decide whether a recruiter can request Jerry before adding an athlete to their pipeline.
7. Approve the initial question-category allowlist.

## Changelog

- **0.1 Draft (2026-08-16)** — Initial contract proposal derived from the executive Jerry–Billy
  presentation, the current platform implementation, and Trello card 38w7uQKw.
