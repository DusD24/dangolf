# Moonfen Links Implementation Plan

**Approved design:** A forgiving par-35 nine with optional spell routes, shots from the actual lie, simple putting, and a scorecard.

**Architecture:** Define the nine holes as terrain and pin data. Keep each swing in the existing local physics frame, and let the round translate shots into hole coordinates and handle penalties, putting, and progression. Reuse the practice scene and spell controls for course play.

- [x] Define and test nine distinct holes, playable tee and green locations, and terrain classification.
- [x] Implement and test round progression, aiming, relief, hole capture, and the nine-hole score.
- [x] Add a course entry, course scenery, hole map, and touch putting. Verify a full round through the normal browser controls.
- [x] Run the complete test suite and verify the published GitHub revision.
