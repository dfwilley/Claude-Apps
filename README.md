# Bin Finder

A native iPhone app for finding things in storage bins. Photograph what's inside each bin, shelf or RV compartment once and list a few things. Later, type what you're looking for ("spare fuses") and it shows which bin, with the photo.

**Download the app file:** https://github.com/dfwilley/Bin-Finder/releases/latest/download/Bin-Finder.ipa
Install it with Sideloadly (USB or Wi-Fi). With a free Apple ID, re-install every 7 days; your bins and photos stay on the phone.

**Web version (no install, runs in Safari):** https://dfwilley.github.io/Bin-Finder/ — same features, in the `docs` folder. Backups move between the web and native versions.

## What it does

- **Bins** grouped by location (Garage, Hangar, RV Rear Bay…), each with photos, a list of what's inside, notes and a short label code like `G-03`.
- **Search** across names, items, labels, locations and notes. It handles plurals ("fuses" finds "fuse"), and it searches words the phone **read in your photos** (printed labels and recognized objects), all on the phone with no internet.
- **QR labels** on Avery 5163 sheets (4 × 2 in, 10 per sheet), for one bin or a whole location. Scan a label with the iPhone Camera to open that bin.
- **Backup and restore**: one file with every bin and photo, to keep in iCloud Drive or Dropbox. Your data is also visible in the Files app under *On My iPhone › Bin Finder*.

## How it's built

Every push to `main` builds on a GitHub cloud Mac: it runs the tests, takes screenshots on an iPhone simulator (saved to the `ci-screenshots` branch), builds an unsigned `.ipa` and publishes it as the latest release.

## Web version

`docs/` holds a web version of the same app. It stores bins and photos in the browser on the phone (nothing is uploaded) and reads printed words in photos with Tesseract.js running in the browser (included in `docs/vendor`; no object recognition in the web version). Labels print from Safari on Avery 5163 sheets. Search rules are shared with the native app and checked by `node tests/web-search.test.js`.
