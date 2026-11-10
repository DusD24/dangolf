# Dangolf

A one-thumb wizard golf prototype. The practice tee runs in a phone or desktop browser.

## Play locally

Run `npm start` and open [the practice tee](http://127.0.0.1:4173/). The server uses Python 3 and the game has no browser dependencies.

- Start at the gold dot and draw the rune back to it. **Guided** shows the selected rune and swing channel. **Hard** shows the dot and your own stroke, and rewards accurate spells with stronger effects.
- In one motion, **pull down** to load, **swipe straight back up**, then **lift** to send it. You can also start with a plain pull and return.
- **Tap just before contact** for a snap bonus. Watch for the club-head glint.
- Tap **Reset** or press **R** for another ball.

The crescent bends the shot, the sword hits a low runner, and the five-point star adds up to 25% power in Hard. The browser unlocks shot audio when you interact with the tee.

For a phone on the same Wi-Fi, start a preview bound to the Mac's Wi-Fi address. On a Mac that uses `en0` for Wi-Fi, run these commands from the project folder and open the printed URL on the phone.

```sh
DANGOLF_WIFI_IP=$(ipconfig getifaddr en0)
printf 'http://%s:4173/\n' "$DANGOLF_WIFI_IP"
python3 -m http.server 4173 --bind "$DANGOLF_WIFI_IP" --directory public
```

Use `npm test` to check the gesture and shot simulation.
