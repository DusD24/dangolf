# Dangolf

A one-thumb wizard golf prototype. The practice tee runs in a phone or desktop browser.

## Play Moonfen Links

Choose **Play 9** at the practice tee for the first course. Moonfen Links is a par-35 nine with three par 3s, four par 4s, and two par 5s.

- Check the live minimap for the ball, flag, and hazards. It shows the nearest hazard crossed by your current aim line.
- Open **Aim / Map** to tap a target, equip a club, and preview plain or snapped carry at 25%, 50%, 75%, and 100% power. The distances account for your lie. Choose **Back to shot** to return and pull to the power you want.
- Play the next shot from where the ball stops. Water and out of bounds add one stroke and send you back to the previous lie.
- On the green, pull back to set putt power and lift to roll. Sink the putt to record the hole and advance. Open **Scorecard** to see the round so far.

## Play locally

Run `npm start` and open [the practice tee](http://127.0.0.1:4173/). The server uses Python 3 and the game has no browser dependencies.

- Start at the gold dot and draw the rune back to it. **Guided** shows the selected rune and swing channel. **Hard** shows the dot and your own stroke, and rewards accurate spells with stronger effects.
- In one motion, **pull down** to load, **swipe straight back up**, then **lift** to send it. You can also start with a plain pull and return.
- **Tap just before contact** for a snap bonus. Watch for the club-head glint.
- Tap **Reset** or press **R** for another ball.

Open **Club Bag** to choose among 14 clubs and compare their plain and centered snap distances. The Guided drawback line marks 25%, 50%, 75%, and full power so you can repeat a shot on the range.

The crescent bends the shot, the sword hits a low runner, and the five-point star adds up to 25% power in Hard. The browser unlocks shot audio when you interact with the tee.

For a phone on the same Wi-Fi, start a preview bound to the Mac's Wi-Fi address. On a Mac that uses `en0` for Wi-Fi, run these commands from the project folder and open the printed URL on the phone.

```sh
DANGOLF_WIFI_IP=$(ipconfig getifaddr en0)
printf 'http://%s:4173/\n' "$DANGOLF_WIFI_IP"
python3 -m http.server 4173 --bind "$DANGOLF_WIFI_IP" --directory public
```

Use `npm test` to check the gesture and shot simulation.
