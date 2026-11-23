# Squadron Flashback

One random question a day about your Navy flying days. Type or dictate the answer and it is saved to a journal your grandchildren can read later.

**Open it on your iPhone:** https://dfwilley.github.io/Claude-Apps/squadron-flashback/
(In Safari, tap Share › **Add to Home Screen** so it opens like an app.)

## What it does

- **Today:** one question a day, picked at random from 136 built-in questions in 12 chapters (plus your own, which come first). Type the answer, or tap the microphone on the iPhone keyboard and talk. "A different question" swaps it; "Not for me" skips it for good. What you have typed is kept if you close the app before saving.
- **Journal:** every story, newest first or by chapter. Find a word, edit a story, delete one, or write a story of your own with no question behind it.
- **Questions:** browse every question, answer any of them now, and add your own.
- **Share:** set the title, your name and a dedication, then **Make the book**: one file with every story that opens in any web browser and prints cleanly. Also plain text for email, a daily Calendar reminder, and backup and restore.

## Privacy

Stories and settings stay on the phone, in the browser's storage for this site. Nothing is uploaded. Make a backup now and then (Share › Back up everything) and keep the file in iCloud Drive or Dropbox.

## Files

- `index.html`, `style.css`, `app.js`: the screens
- `core.js`: the rules (which question comes up, the journal, the book, backups), checked by `tests/squadron-flashback.test.js`
- `questions.js`: the question bank. Add new questions at the end of a chapter so saved answers keep pointing at the right question
- `reminders/`: ready-made daily Calendar reminders, one per half hour
- `sw.js`, `manifest.webmanifest`, `icon.svg`, `icons/`: Home Screen and offline support
