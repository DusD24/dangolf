# Dangolf

A one-thumb wizard golf prototype. The practice tee runs in a phone or desktop browser.

## Play locally

Run `npm start` and open [the practice tee](http://127.0.0.1:4173/). The server uses Python 3 and the game has no browser dependencies.

- Press the tee and **pull down** to load the spectral club.
- **Swipe back up and lift** to start the downswing. The return path steers the club.
- **Tap again just before contact** to snap the tether. Watch for the glint near the club head.
- Tap **Reset** or press **R** to set up another ball.

For a phone on the same Wi-Fi, start a preview bound to the Mac's Wi-Fi address. On a Mac that uses `en0` for Wi-Fi, run these commands from the project folder and open the printed URL on the phone.

```sh
DANGOLF_WIFI_IP=$(ipconfig getifaddr en0)
printf 'http://%s:4173/\n' "$DANGOLF_WIFI_IP"
python3 -m http.server 4173 --bind "$DANGOLF_WIFI_IP" --directory public
```

Use `npm test` to check the gesture and shot simulation.
