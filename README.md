# Dangolf

A one-thumb wizard golf prototype. The practice tee runs in a phone or desktop browser.

## Play Moonfen Links

Choose **Play 18** at the practice tee. Moonfen Links plays to par 71 over 18 holes.

- Check the live minimap for the ball, flag, and hazards. It shows the nearest hazard crossed by your current aim line.
- Open **Aim / Map** to tap a target, equip a club, and compare plain carry, centered snap, and spell carry at 95% purity with or without a centered snap. The automatic club is the closest full-power centered carry from your lie. The planner shows how much mana a solid plain shot can restore.
- Tree lines catch shots that fly into the canopy. Play from where the ball drops. On doglegs, lay up at the corner or curve a Crescent around the trees. Water and out of bounds add one stroke and send you back to the previous lie.
- On the green, downhill arrows show the break. Tap **Aim left** or **Aim right** by the main controls for half-degree adjustments. **Aim / Map** gives a closer read. Pull down to set pace and lift to roll. A putt can run past the cup if it comes in hot. Open **Scorecard** to see the round so far.
- In the Spellbook, trace **Texas Wedge** and pull down to smooth a putt from within four yards of the green edge. It costs 40 mana and refunds some on a good cast. On the green, trace the **Royal Flush** spiral and pull down. It costs 80 mana, and 90% purity guarantees the drop. Lower purity leaves an ordinary putt. Plain putts are free.

## Play locally

Run `npm start` and open [the practice tee](http://127.0.0.1:4173/). The server uses Python 3 and the game has no browser dependencies.

- Start at the gold dot and draw the rune back to it. **Guided** shows the selected rune and swing channel. **Hard** shows the dot and your own stroke, and rewards accurate spells with stronger effects.
- In one motion, **pull down** to load, **swipe straight back up**, then **lift** to send it. You can also start with a plain pull and return.
- **Tap at contact** for bonus carry. The club-head glint marks the timing window. An early tap chunks the shot and a late tap tops it.
- Tap **Reset** or press **R** for another ball.

Open **Club Bag** to choose among 14 clubs and compare shot types. The Guided drawback line marks 25%, 50%, 75%, and full power so you can repeat a shot on the range.

Equip three swing runes in the Spellbook. On the course, Star starts armed on the tee when equipped and affordable. Other shots start plain. Choose a slot to arm a spell or tap **Cancel spell** to return to a plain shot. Guided traces the active slot. Hard accepts any equipped swing rune while casting is armed. A round starts with 100 mana and swing casts cost 40. Solid swing casts at 90% purity or higher refund mana, with extra for centered contact. Solid plain swings and moving to the next hole restore mana. Practice swing mana is unlimited.

Crescent bends the shot, Spear hits a low runner, and Star boosts carry. To cast Spear, trace the diamond head and keep moving straight down the shaft into the pull. The browser unlocks shot audio when you interact with the tee.

For a phone on the same Wi-Fi, start a preview bound to the Mac's Wi-Fi address. On a Mac that uses `en0` for Wi-Fi, run these commands from the project folder and open the printed URL on the phone.

```sh
DANGOLF_WIFI_IP=$(ipconfig getifaddr en0)
npm start -- --bind "$DANGOLF_WIFI_IP"
```

Use `npm test` to check the gesture and shot simulation.
