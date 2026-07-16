# FS-CS-005 — Athlete Representation Activation

**Version:** 1.0 Official · **Status:** Foundational · **Classification:** Representation Architecture
**Owner:** First Stringers · **Depends On:** FS-CS-000, 001, 002, 003, 004

## Purpose

Athlete Representation Activation is the process through which Jerry develops sufficient
understanding to begin representing an athlete. It is not account creation, not profile completion,
not onboarding — it is the moment an athlete **activates intelligent representation**.
Representation begins only after Jerry has developed enough understanding to responsibly advocate
for the athlete.

## Guiding Principle

Jerry cannot represent what he does not understand. Every question during activation exists to
reduce uncertainty and improve future representation. The objective is never to collect
information; the objective is to build understanding.

## Representation Threshold

Jerry should not actively represent an athlete until a minimum representation threshold is
achieved. Athletes below the threshold remain in the Activation stage; Jerry avoids making strong
recommendations about them until enough understanding exists.

## Representation Status (lifecycle)

| Stage | Status | Meaning |
|---|---|---|
| 1 | **Registered** | Account created. Representation has not begun. |
| 2 | **Representation Activation** | Jerry is actively learning; the Owner's Manual is being initialized. **No recruiter-facing dossier is available.** |
| 3 | **Represented** | Minimum threshold achieved. First recruiter-facing dossier generated. **Billy may now confidently include the athlete in recommendations.** |
| 4 | **Verified Representation** | Key information validated through trusted sources (verified measurements, academic records, coach references, platform verification). |
| 5 | **Continuously Learning** | Representation never ends — it strengthens through conversations, performances, film, academics, recruiting activity, Owner's Manual development. |

> **Implementation note:** stages 1–4 are persisted as `Athlete.representationStatus`
> (`registered` → `activation` → `represented` → `verified`). Stage 5 is not a distinct persisted
> state — it is the permanent operating mode of every athlete at stage 3+ (Jerry's `continuous`
> conversation mode).

## Objectives of Activation — four foundational understandings

1. **Identity** — who the athlete is.
2. **Athletic Foundation** — how the athlete currently competes.
3. **Recruiting Direction** — where the athlete wants to go.
4. **Representation Foundation** — how Jerry should represent the athlete.

## Required Information (minimum foundation)

Athlete identity, athletic profile, competitive level, recruiting objectives, academic direction,
geographic preferences, representation preferences, initial Owner's Manual, availability of
recruiting assets.

> **Implementation note:** the platform's `REPRESENTABLE_FIELDS` set
> (`apps/api/src/modules/jerry/strategy-planner.service.ts`) is the operational encoding of this
> threshold — identity + initial athletic snapshot + general goals.

## The Owner's Manual

Activation initializes the athlete's first Owner's Manual — Jerry's internal understanding of the
athlete (not a recruiting profile): motivations, goals, learning preferences, communication
preferences, competitive identity, values, preferred environments, decision-making tendencies,
long-term aspirations. It evolves continuously.

## Recruiter Visibility

Recruiters should not receive incomplete representation. **Billy only recommends athletes whose
representation has reached the minimum activation threshold.** Recruiter-facing dossiers reflect
athletes Jerry understands well enough to represent responsibly. This protects both athlete trust
and recruiter confidence.

## Representation Philosophy

Representation is earned through understanding. Jerry always prioritizes representation quality
over activation speed.

## Definition of Success

Jerry understands the athlete well enough to represent them honestly, advocate intelligently,
evaluate opportunities responsibly, support long-term decisions, and generate a recruiter-facing
dossier that reflects meaningful understanding. The objective is not profile completion — it is
**trusted representation**.

## Foundational Statement

Representation is not activated when forms are completed. It is activated when understanding
reaches the level required to responsibly advocate for another person. Every athlete deserves to be
represented. Every recruiter deserves representation they can trust.

## Changelog

- **1.0 (2026-07)** — Initial official version (+ implementation notes mapping stages to
  `representationStatus` and `REPRESENTABLE_FIELDS`).
