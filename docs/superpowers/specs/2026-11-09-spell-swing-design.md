# Dangolf spell swing

## Intent and scope

Add three drawable spells to the practice tee. The shape chooses the shot, and the quality of the continuous thumb motion controls how strongly it works. Preserve the rear camera, open hitting surface, and yardage readouts. The tee is the first place to tune recognition, rhythm, and flight before this mechanic is used on courses.

## Approaches

- **Chosen: release sends the rune shot, with an optional snap.** The upward release commits a complete spell swing. A precisely timed second tap rewards players who can layer a snap on top.
- **Considered: require a snap to activate the spell.** A mandatory tap makes the final beat decisive. It also makes a completed glyph, pull, and return depend on a separate action.

## The swing

1. Touch down at the rune's starting point and draw it. Each of the starter runes can be drawn in one pass and returns to a point where the thumb can continue straight down.
2. Without lifting, pull down to load the club. The pull starts at the rune's exit. Drawing the rune adds zero load. Use the current full-power pull distance from that exit.
3. Reverse and swipe up to steer, then lift to start the downswing and arm the spell. The club must hit the ball for any modifier to take effect.
4. Tap in the existing snap window for an optional boost. A clean tap adds up to **10% launch energy** as a starting tuning value. On a spell shot, an early or late tap gives timing feedback and the rune's release still plays out.

A straight pull and return with no glyph follows the current plain-swing rules, including the existing snap. An unrecognized glyph falls back to that same swing if its pull and return are valid. An incomplete pull or return leaves the ball ready for another attempt.

## Purity

Score the completed spell stroke from 0 to 100. Start with 50% shape geometry, 20% rune pace, and 30% rhythm through the pull and return.

- **Geometry** compares the player's path with the rune's proportions, key turns, and closure after accounting for hand-drawn scale and location. It preserves orientation where that changes the shot. Use a minimum match threshold before a path earns a spell.
- **Pace** uses a timing target for each rune's complexity. The star has more turns and earns a longer drawing budget than the crescent.
- **Rhythm** rewards a flowing transition into the pull and a clean reversal into the return. A pause after the rune or at the bottom lowers the score. Pull depth still sets load. Lateral drift on the return still steers the club.

Show the recognized rune and purity after the shot. Indicate whether the optional snap landed and identify the weakest part of an otherwise valid cast so the next attempt gives the player something to improve.

## Starter spells

| Rune | Flight effect |
|---|---|
| Crescent | Bends the ball in flight. The mirrored crescent reverses the bend. Purity controls the amount of curve. |
| Sword | Lowers launch into a stinger and lets the ball run farther after landing. Purity controls how strongly it flattens the shot and extends the roll. |
| Five-point star | Raises launch energy up to **125%** of the same spell swing's unmodified power at full purity in Hard mode. The optional snap boost applies separately. |

A high-purity, full-load rune release should feel like a driver even before the optional tap. Start by tuning an equivalent unmodified rune release near **240–250 yd carry**. Use the current club contact and ball simulation, with rune-dependent changes to launch and flight. A bad swipe can still hit the turf or miss.

## Modes

**Guided** is the starting mode. The player picks a rune and sees its path and the vertical swing channel underneath. The selected rune is the match target, and the crescent guide can face either direction. Guides clear on release so the shot remains visible. Geometry and rhythm still matter. Start with 60% of the Hard spell effect at the same purity, so a perfect Guided star reaches 115% power.

**Hard** starts from a clear screen and recognizes the drawn rune across the starter catalog. It uses the full effect at a given purity, with the five-point star reaching 125%. Both modes show the result in the existing top readout area and keep the tee clear. Reset keeps the chosen mode and guide and clears the last shot.

## First playtest

- Draw all three runes through their pull and return using one thumb, then compare Guided and Hard results for equivalent strokes.
- Compare a fluent cast with a paused cast and a distorted shape. Try a plain swipe and an invalid rune to check both fallback paths.
- Hit a spell shot on release alone and repeat with a clean snap, an early tap, and a late tap.
- Confirm that mirrored crescents curve in opposite directions, the sword flies lower and rolls farther, and the star adds the stated amount of energy.
- Check that the rune and channel fit a narrow phone screen with the full pull distance available.

The builder can choose the first geometry templates, pace targets, and recognition tolerances. Treat the proposed score weights, effect cap, snap boost, and driver baseline as playtest tuning values.
