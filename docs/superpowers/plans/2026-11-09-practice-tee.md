# Dangolf Practice Tee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution or superpowers:subagent-driven-development for delegated execution.

**Goal:** Make the approved one-thumb wizard swing playable and immediately repeatable.

**Architecture:** An isolated fixed-step simulation owns the gesture, driven club, and free ball. A canvas client projects the simulation and translates touch or mouse events into the same controls.

**Tech stack:** HTML, CSS, JavaScript modules, Canvas 2D, Node's test runner.

**Approved design:** Start beside a ball at fixed aim. Pull down to load, reverse into an upward swipe to steer, and lift to start the swing. Tap again just before contact to snap the tether. The club must physically collide with the ball. Use one flat tee and instant reset.

## Constraints

- The center of the stroke is forgiving. Snap timing supplies most of the difficulty.
- The club, wizard, and turf show the cause of a mishit.
- The practice build runs in a portrait phone browser and accepts a mouse for desktop testing.

## Review focus

- A tap or incomplete swipe leaves the tee ready.
- Cancellation and reset discard the active gesture.
- Small drift still allows contact. Large drift can cause a clean miss.
- Timing changes the club before contact. A late snap leaves the launched ball alone.
- Fast swings still register actual contact between fixed steps.

## 1. Simulate the swing

- [ ] Add `tests/practice.test.js` for gesture recognition, short and full windups, aiming, early and clean snaps, misses, late snaps, and reset.
- [ ] Run `node --test` and confirm it fails because `public/src/practice.js` is missing.
- [ ] Add `Practice` in `public/src/practice.js` with gesture methods, reset, a fixed-step update, and swept club contact. Expose poses and outcome data to the renderer.
- [ ] Run `node --test` and confirm the mechanics pass.

## 2. Make the tee playable

- [ ] Exercise the browser entry point with a phone-sized viewport and a real touch sequence.
- [ ] Add the canvas scene, pointer controls, progress cues, shot result, and reset.
- [ ] Verify the phone and desktop layouts plus swipe, snap, collision, cancellation, and retry in the browser.
- [ ] Run the full suite and commit the build to the requested GitHub repository.
