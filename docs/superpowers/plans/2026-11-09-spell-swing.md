# Spell Swing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution or superpowers:subagent-driven-development for delegated execution.

**Goal:** Play a complete rune, pull, and release on the practice tee, with an optional snap and layered shot audio.

**Architecture:** The input controller collects a timed stroke. A pure analyzer separates the rune from the swing and grades it, the existing simulation handles club contact and flight, and the scene and sound use the resolved state.

**Tech Stack:** JavaScript modules, Canvas 2D, Web Audio, Node test runner.

**Spec:** [Spell swing design](../specs/2026-11-09-spell-swing-design.md) and the approved addition of hit, whiff, turf, max-power, and per-spell audio.

## Global constraints

- One continuous stroke draws the rune, loads on the pull, and releases the swing.
- The snap is optional for a rune swing. The regular shot remains available.
- Guided mode traces a selected rune and swing channel. Hard mode recognizes freehand without guides.
- The club must physically contact the ball. Full Hard star potency gives 125% launch energy.
- Play standard shot sounds with a distinct success or failure layer for each recognized rune.

## Review focus

- A glyph by itself leaves the ball at the tee. An unknown glyph with a valid swing gives a normal shot.
- Rune drawing contributes zero swing load and its turns contribute zero steering drift.
- A hold at either transition reduces rhythm. Geometry, pace, and rhythm can independently affect the score.
- A miss or turf strike gets failure audio even when the rune was correctly recognized.
- Optional tap, reset, touch cancellation, and small-screen guides work through the normal browser controls.

## Tasks

### 1. Recognize the stroke

- [x] In `tests/spells.test.js`, write failing cases for all guides, Hard matching and mirroring, bad geometry, plain strokes, pause and pace. Run `npm test` and check the expected failure.
- [x] In `public/src/spells.js`, provide rune paths and `analyzeStroke(points, mode, guideId)` returning the swing slice, match and purity. Verify the gesture cases.

### 2. Apply shot effects

- [x] Add tests for release-only carry, snap energy, both crescent directions, sword flight and roll, Hard and Guided star power, and contact gating.
- [x] Extend `Practice.releaseStroke` to arm a spell. Apply energy, loft, bend, and roll in the existing strike and flight paths. Verify all existing normal shots and the new cases.

### 3. Wire controls and sound

- [x] Verify failure of a browser check for mode controls and runtime audio. Add Guided and Hard controls, trace geometry and score feedback, and wire the input and simulation together.
- [x] Add sound selection tests, then synthesize contact, pure drive, explosion, whiff, turf, and each rune's success and failure layers in `public/src/audio.js`.
- [x] Verify real touch through release and snap on the tee, plus fallbacks, mode switching, reset, audible sample rendering, and the narrow layout. Review and publish the verified build to GitHub.
