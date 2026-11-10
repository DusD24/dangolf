# Dangolf

A one-thumb wizard golf prototype. The practice tee runs in a phone or desktop browser.

## Play Moonfen Links

Choose **Play 9** at the practice tee for the first course. Moonfen Links is a par-35 nine with three par 3s, four par 4s, and two par 5s.

- Check the live minimap for the ball, flag, and hazards. It shows the nearest hazard crossed by your current aim line.
- Open **Aim / Map** to tap a target, equip a club, and compare plain carry, centered snap, a pure cast of your active spell, and a pure cast with a centered snap. The distances account for your lie. Choose **Back to shot** to return and pull to the power you want.
- Play the next shot from where the ball stops. Water and out of bounds add one stroke and send you back to the previous lie.
- On the green, pull back to set putt power and lift to roll. Sink the putt to record the hole and advance. Open **Scorecard** to see the round so far.

## Play locally

Run `npm start` and open [the practice tee](http://127.0.0.1:4173/). The server uses Python 3 and the game has no browser dependencies.

- Start at the gold dot and draw the rune back to it. **Guided** shows the selected rune and swing channel. **Hard** shows the dot and your own stroke, and rewards accurate spells with stronger effects.
- In one motion, **pull down** to load, **swipe straight back up**, then **lift** to send it. You can also start with a plain pull and return.
- **Tap at contact** for bonus carry. The club-head glint marks the timing window. An early tap chunks the shot and a late tap tops it.
- Tap **Reset** or press **R** for another ball.

Open **Club Bag** to choose among 14 clubs and compare shot types. The Guided drawback line marks 25%, 50%, 75%, and full power so you can repeat a shot on the range.

Equip three runes in the Spellbook. Guided traces the active slot. Hard accepts any equipped rune. A round starts with 100 mana and every committed cast costs 40. Solid casts at 90% purity or higher refund mana, with extra for centered contact. Solid plain shots and moving to the next hole restore mana. Practice mana is unlimited.

Crescent bends the shot, Spear hits a low runner, and Star boosts carry. To cast Spear, trace the diamond head and keep moving straight down the shaft into the pull. The browser unlocks shot audio when you interact with the tee.

For a phone on the same Wi-Fi, start a preview bound to the Mac's Wi-Fi address. On a Mac that uses `en0` for Wi-Fi, run these commands from the project folder and open the printed URL on the phone.

```sh
DANGOLF_WIFI_IP=$(ipconfig getifaddr en0)
npm start -- --bind "$DANGOLF_WIFI_IP"
```

Use `npm test` to check the gesture and shot simulation.
