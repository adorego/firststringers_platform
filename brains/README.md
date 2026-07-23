# First Stringers Intelligence Core — Cognitive Specifications

This folder is the **source of truth** for how First Stringers' intelligences (Billy and Jerry)
reason, decide, communicate, and represent people. It transcribes the official Cognitive
Specifications authored by Abel (FS-CS series, v1.0, 2026-07). The original PDFs live in
`ENGINEERING/cerebros-abel/` (outside this repo).

The production system prompts in `apps/api` are **derived from these specs** — most directly
`apps/api/src/modules/jerry/prompt-builder.service.ts` (Jerry) and
`apps/api/src/modules/billy/billy.worker.ts` (Billy). When a spec changes, the prompts and any
gated behavior (e.g. FS-CS-005 representation lifecycle) must be updated in the same PR.

## Index

| Spec | Title | Governs |
|---|---|---|
| [FS-CS-000](FS-CS-000-intelligence-system.md) | First Stringers Intelligence System | Everything — mission, architecture, operating standards |
| [FS-CS-001](FS-CS-001-billy-operating-brain.md) | Billy Operating Brain | Billy's reasoning and ethics |
| [FS-CS-002](FS-CS-002-jerry-operating-brain.md) | Jerry Operating Brain | Jerry's reasoning and ethics |
| [FS-CS-003](FS-CS-003-communication-standards.md) | Communication & Interaction Standards | How reasoning is expressed |
| [FS-CS-004](FS-CS-004-identity-self-representation.md) | Identity & Self-Representation | How the intelligence presents itself |
| [FS-CS-005](FS-CS-005-athlete-representation-activation.md) | Athlete Representation Activation | Athlete lifecycle: Registered → Activation → Represented → Verified → Continuously Learning |
| [FS-CS-005A](FS-CS-005A-athlete-representation-activation-conversation.md) | Athlete Representation Activation Conversation | Jerry's activation conversation sections, rhythm, summary, and adaptive rules |
| [FS-CS-006](FS-CS-006-jerry-activation-leadership.md) | Jerry Activation Leadership | How Jerry acknowledges athlete input while continuing the Dossier flow |
| [FS-CS-007](FS-CS-007-billy-conversation-quality.md) | Billy Conversation Quality | Billy v2: objective-first conversations, uncertainty, and reasoned recommendations |

## Governance (Abel's process)

Any meaningful change to how Billy or Jerry reason follows this flow — never a quick prompt edit:

1. **Observe** — a demo, athlete/coach conversation, or test reveals the intelligence should reason differently.
2. **Discuss** — the observation is raised with the team.
3. **Document** — if agreed, it becomes a new Cognitive Specification or a new version of an existing one, in this folder, via PR.
4. **Approve** — Abel reviews the PR; the approval and its reasoning stay in the git history.
5. **Deploy** — the derived prompts/behavior in `apps/api` are updated in the same PR; the ChatGPT "Intelligence Core" sandbox is updated with the same version.

This keeps a single source of truth, preserves the reasoning behind every decision, and satisfies
FS-CS-000's requirement that the intelligence remain **independent of any AI provider**: the specs
live in git, not inside any one vendor's product.

## Versioning

Each spec carries its version in its header. Changes bump the version and are summarized in a
`## Changelog` section at the bottom of the spec.
