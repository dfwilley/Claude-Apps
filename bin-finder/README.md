# Bin Finder

A native iPhone app for finding things in storage bins. Photograph what's inside each bin, shelf or RV compartment once and list a few things. Later, type what you're looking for ("spare fuses") and it shows which bin, with the photo.

**Download the app file:** https://github.com/dfwilley/Bin-Finder/releases/latest/download/Bin-Finder.ipa
Install it with Sideloadly (USB or Wi-Fi). With a free Apple ID, re-install every 7 days; your bins and photos stay on the phone.

**Web version (no install, runs in Safari):** https://dfwilley.github.io/Bin-Finder/ — same features, in the `docs` folder. Backups move between the web and native versions.

## What it does

- **Bins** grouped by location (Garage, Hangar, RV Rear Bay…), each with photos, a list of what's inside, notes and a short label code like `G-03`.
- **Search** across names, items, labels, locations and notes. It handles plurals ("fuses" finds "fuse"), and it searches words the phone **read in your photos** (printed labels and recognized objects), all on the phone with no internet.
- **Places inside places**: type a location like `Hangar / Shelf 2 / Left`. The main list groups by the top place; tap a group heading to open it and see the places inside. Rename or move a place and every bin inside follows. Labels can be printed for everything in a place.
- **Trip checklist**: switch on "Pack for trips" for the bins that get loaded for an RV trip. The checklist shows each thing in those bins to check off as it goes in the rig, with a "Start a new trip" button to uncheck everything.
- **Voice search**: tap the microphone and say "where's the spare fuses". Filler words like *where's*, *did I put* are ignored. The native app listens on the phone itself when it can; the web version uses Safari's speech recognition (falls back to the keyboard microphone).
- **QR labels** on Avery 5163 sheets (4 × 2 in, 10 per sheet), for one bin or a whole location. Scan a label with the iPhone Camera to open that bin.
- **Backup and restore**: one file with every bin and photo, to keep in iCloud Drive or Dropbox. Your data is also visible in the Files app under *On My iPhone › Bin Finder*.

## First test on the phone (about 15 minutes)

1. **Open it.** Web: open the link in Safari, Share › Add to Home Screen, and use it from the Home Screen from then on. Native: install the latest `.ipa` with Sideloadly.
2. **Add three bins** with a photo each: one in `Garage`, one in `Hangar / Shelf 2`, one in `RV / Rear bay`. Put a printed label or package in at least one photo.
3. **Search by typing**: an item you listed, then a word printed in a photo (give it a minute to read the photo).
4. **Search by voice**: tap the microphone, allow it, and say "where's the …". It should stop by itself and show the bin.
5. **Places**: on the main list tap the **Hangar** heading, then **Shelf 2**. Try *Rename or move this place* and check the bin's location changed.
6. **Trip checklist**: switch on *Pack for trips* for the RV bin, open *Trip checklist*, check two things off, close the app, reopen, and see they're still checked. Then *Start a new trip*.
7. **Label**: print one QR label on plain paper, scan it with the Camera, and see that it opens the bin.
8. **Backup**: *⋯ › Back up everything*, save to Files; restore it in the other version to check backups move both ways.

Anything odd: note the step number and what you saw.

## How it's built

Every push to `main` builds on a GitHub cloud Mac: it runs the tests, takes screenshots on an iPhone simulator (saved to the `ci-screenshots` branch), builds an unsigned `.ipa` and publishes it as the latest release.

## Web version

`docs/` holds a web version of the same app. It stores bins and photos in the browser on the phone (nothing is uploaded) and reads printed words in photos with Tesseract.js running in the browser (included in `docs/vendor`; no object recognition in the web version). Labels print from Safari on Avery 5163 sheets. Search rules are shared with the native app and checked by `node tests/web-search.test.js`.
