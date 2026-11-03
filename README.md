[README.md](https://github.com/user-attachments/files/34302032/README.md)
# Nova Run

A small browser arcade game built with HTML, CSS, and JavaScript.

## How to play

- Move: A / D or Left / Right arrow keys
- Shoot: Space bar
- On touch screens: use the Left, Right, and Fire buttons below the game
- Toggle sound effects with the Sound button and the layered synth soundtrack with the Music button
- Start a run to begin the soundtrack; audio starts after a button press to work with browser audio restrictions
- Collect purple weapon upgrades to raise your weapon level for 12 seconds, spreading your shots and adding visible ship cannons (up to level 3). Active skill durations are shown on screen.
- Collect a pink Nova item (about one in five drops), then press the glowing NOVA button or X to clear enemy ships and shots in a screen-wide blast. Only one charge can be carried at a time.
- Runs start with five lives, slower enemy waves, and more frequent power-ups for a more relaxed challenge
- Objective: survive the enemy wave and collect power-ups
- Bosses arrive every five levels with more health, faster movement, five-way spread volleys, and aimed triple shots. Dodge their attacks and hit them to clear the encounter.

The title screen includes your saved best score. Best score is stored in your browser.

## Run locally

Open `nva run.html` in a browser, or serve the folder with any static file server.

Example:

```bash
cd C:\Users\amor2\Desktop\gameeee\first mini game
npx --yes http-server . -p 8000
```

Then visit http://localhost:8000
