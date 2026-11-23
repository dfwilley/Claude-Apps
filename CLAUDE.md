# Handoff note for Claude Code: Claude-Apps

Read this first, then `README.md`, which describes what each app does. This note covers how the owner works, how the repository is laid out, how changes reach his phone, and the traps.

## The owner and how to work with him

- The owner is not a programmer. Claude writes all the code. Explain things in plain language and define technical terms.
- He has a Windows PC and an iPhone. **There is no Mac.** Everything Apple-related is built on GitHub's cloud Macs (GitHub Actions). Never suggest opening Xcode.
- He has a paid Apple Developer account. Apps reach phones by TestFlight or by Sideloadly on the PC.
- When work is finished and its tests pass, merge it to `main` without asking (the owner's standing instruction, November 15, 2026). Still say what was released.
  - **Exception: The Job Jar!** While it is being developed, do not push its changes to `main` until the owner says to (his instruction, November 18, 2026). Work on a branch. To compile and test the iPhone/iPad app, start `job-jar-ios.yml` by hand on that branch; a branch build publishes its `.ipa` as the `job-jar-dev` release and leaves `job-jar-latest` alone.
- Lead with the result, then limitations. Make low-risk decisions without asking. Ask first before deleting files, publishing anything new, spending money, or any change that can't be undone.
- Keep changes focused on what was asked. Don't add dependencies unless the task needs them.
- Commit messages follow the existing pattern: `App name: what changed, in plain words` (see `git log`).

## Layout

Each app is a plain web app in its own top-level folder: HTML, CSS and JavaScript with **no build step and no package manager**. Third-party libraries are copied into the app's `vendor/` folder with their licenses. GitHub Pages serves the repository at https://dfwilley.github.io/Claude-Apps/.

| Folder | App | iPhone version |
|---|---|---|
| `knot-of-the-day/` | Knot of the Day | none |
| `wire-bender/` | Wire Bender | none |
| `ask-me-tomorrow/` | Ask Me Tomorrow | none |
| `who-was-here/` | Who Was Here | none |
| `gate-time-puzzles/` | Gate Time Puzzles | none |
| `which-gear-goes-where/` | Which Gear Goes Where | none |
| `wing-rib-riddles/` | Wing Rib Riddles | none |
| `bend-it-right/` | Bend It Right | none |
| `fit-the-part/` | Fit the Part | none |
| `gear-bag-check/` | Gear Bag Check | none |
| `squadron-flashback/` | Squadron Flashback | none |
| `brick-pile/` | Brick Pile Builder (called Brick Pile in the code and workflows). **Shelved** November 21, 2026 | `native/brick-pile/`, web app inside a native shell; builds only when started by hand |
| `blue-book/` | Blue Book | `native/blue-book/`, web app inside a native shell (TestFlight) |
| `hgvc-binder/` | HGVC Binder | `native/hgvc-binder/`, web app inside a native shell (TestFlight) |
| `bin-finder/` | Bin Finder | `native/bin-finder/`, separately written in SwiftUI |
| `job-jar/` | The Job Jar! | `native/job-jar/`, separately written in SwiftUI, iPhone and iPad (TestFlight) |

Two kinds of iPhone app live under `native/`:

- **Shells** (Blue Book, HGVC Binder, Brick Pile): the app's `project.yml` bundles the web folder as-is and shows it in a web view, adding native extras such as Face ID or reminders. A change to the web folder changes the iPhone app too.
- **Separate native apps** (Bin Finder, The Job Jar!): the Swift code repeats the web app's rules. For example `native/job-jar/JobJar/Core.swift` must match `job-jar/core.js`, and Bin Finder's search tests use the same cases on both sides. **Change both sides together**, or the web and iPhone versions will behave differently.

Each native app is defined by a `project.yml` that XcodeGen turns into an Xcode project during the cloud build. Generated projects and `Info.plist` files are not checked in (see `.gitignore`).

## Tests

No install is needed. Run them with Node from the repository root:

```
node tests/bend-it-right.test.js
node tests/bin-finder.test.js
node tests/blue-book.test.js
node tests/brick-pile.test.js
node tests/fit-the-part.test.js
node tests/gate-time-puzzles.test.js
node tests/gear-bag-check.test.js
node tests/hgvc-binder.test.js
node tests/job-jar.test.js
node tests/squadron-flashback.test.js
node tests/which-gear-goes-where.test.js
node tests/who-was-here.test.js
node tests/wing-rib-riddles.test.js
```

All thirteen passed on November 23, 2026. Knot of the Day, Wire Bender and Ask Me Tomorrow have no automated tests. The Swift unit tests and screenshot tests under `native/*/` need a Mac, so they run only in GitHub Actions.

## How a change reaches the phone

**A push to `main` is a release.** There is no staging step.

- The web apps go live on GitHub Pages as soon as they are pushed.
- **Blue Book is the exception:** its two iPhone workflows (`blue-book-ios.yml`, `blue-book-testflight.yml`) run only when started by hand, at the owner's request (November 16, 2026). A push to `main` updates the Blue Book web app only. Start both workflows when he asks for an iPhone build, and tell him the web and iPhone versions may differ until then.
- **Brick Pile Builder is shelved** (the owner's decision, November 21, 2026: an existing app already does the same job). Its files, web page and last Sideloadly build are kept, but its two workflows (`brick-pile-ios.yml`, `brick-pile-testflight.yml`) run only when started by hand. Don't work on it or start its builds unless he asks.
- Each other `...-ios.yml` workflow runs when its app's files change: it runs the tests, builds an unsigned `.ipa`, and replaces the `<app>-latest` release (for Sideloadly).
- Blue Book, HGVC Binder and The Job Jar! also have `...-testflight.yml` workflows that sign and upload to TestFlight on every push that touches them. Blue Book's runs its Node tests first; the other two **do not run the tests**, so a change with failing tests can still be uploaded. Check the test run before calling work finished.
- Signing uses four repository secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`. Never print or log them. The shared helper scripts are in `.github/scripts/`.
- Some workflows push screenshots to branches named `ci-screenshots-...`. Those branches are overwritten on every run; don't build on them.

For anything larger than a small fix, work on a branch and merge to `main` only when it is ready.

## Things that are easy to get wrong

- **Offline caching.** Every web app has a service worker (`sw.js`) with a named cache (for example `jj-v2`) and a list of files to keep for offline use. When you add, rename or remove a file the app needs, update that list, and raise the cache version so phones drop the old copy.
- **Bin Finder's About screen.** Each Bin Finder release needs a new entry in `CHANGES` in `bin-finder/app.js` and in `native/bin-finder/BinFinder/AboutView.swift`, with `VERSION` and `BUILD` in `app.js` matching `MARKETING_VERSION` in `project.yml` and the cache number in `sw.js`. `tests/bin-finder.test.js` fails if they drift.
- **Personal data never goes in this repository.** It is public. HGVC Binder reads its data file from the owner's Dropbox (layout in `hgvc-binder/DATA-FORMAT.md`). Blue Book, Bin Finder, Ask Me Tomorrow, Squadron Flashback and The Job Jar! keep everything on the device. Test data must be made up.
- **Everything stays on the device** is a promise made in several apps' descriptions. Don't add analytics, accounts or cloud storage without the owner asking. The one exception the owner asked for (November 21, 2026) is Bin Finder's optional **Scan with AI**: it sends a bin's photos to Anthropic's API only when he taps that button, using his own API key typed into the app. The key is stored on the device only (browser storage on the web, Keychain on iPhone) and must never be put in this repository or in backups.
  - Blue Book has two exceptions the owner asked for (November 19, 2026), both off until he turns them on: the web app can keep the logbook in a folder he chooses, and it can send a picture of each page to the Claude API (`blue-book/js/ai.js`, his own key, kept in the browser only) because the in-browser reader cannot read handwriting. The page's Content-Security-Policy allows `api.anthropic.com` and nothing else. Keep the key out of the logbook file, backups and the repository.
  - Brick Pile works with nothing leaving the device: `brick-pile/finder.js` counts bricks by colour and rough size, and `brick-pile/builds.js` holds the built-in builds (the owner asked for a no-key mode on November 21, 2026). Only if the owner saves his own Anthropic key (kept in the browser only) do the picture of the bricks, and later the list of bricks, go to the Claude API (`brick-pile/core.js`). Same Content-Security-Policy rule as Blue Book. Both ways must keep working. The app's name and icon avoid the LEGO name and logo on purpose (trademark); keep it that way.
- The Job Jar! is used by young children. It links a kid's device to a grown-up's over home Wi-Fi only, with no internet or cloud. Keep it that way.
- Wing Rib Riddles draws every picture in code (`ITEMS` in `wing-rib-riddles/core.js`, each a 200 x 200 drawing with a close-up window). A new riddle needs a drawing, at least three wrong choices and a checked fact. The riddle of the day comes from the day number, so adding riddles reshuffles which one falls on which day.
- Bend It Right's shapes (`RAW` in `bend-it-right/core.js`) are corner points; leg lengths are rounded to 1/8 inch and turns to 1 degree, so pick points whose slanted legs land near eighths (3-4-5 triangles) or a closed shape will not close. Saved patterns are the player's bends for a shape id, so changing an existing shape's points makes old saved patterns for it look wrong; add new shapes rather than reshaping old ones.
- Fit the Part's answers are never typed in: each puzzle in `PUZZLES` in `fit-the-part/core.js` lists its given numbers (three sets) and its clues as simple sums, and the app solves them. A new puzzle needs clues that give exactly one answer of at most three decimal places for every set, a drawing whose dimensions match, the working, and a SolidWorks part idea; `tests/fit-the-part.test.js` checks all of that.
- Brick Pile's built-in builds (`BUILDS` in `brick-pile/builds.js`) are each written as a side view, one line of text per layer from the bottom up (`B24@0:a` is a 2 x 4 brick starting 0 studs from the left, in colour group a). The pieces needed, the picture and the steps all come from that. A new build needs every piece to rest on a piece below it; `tests/brick-pile.test.js` checks that.
- Squadron Flashback's questions (`squadron-flashback/questions.js`) get their ids from their place in a chapter, and saved answers point at those ids. Add new questions at the end of a chapter; don't reorder or remove old ones. The question of the day is picked from the date, so the same day always shows the same question.
- Who Was Here uses live Wikidata, Wikipedia and OpenStreetMap services. Be gentle with request volume and keep the attribution.
- New web apps go in a new top-level folder and get a line in `README.md`. A native version goes under `native/<app>/` with its own workflows copied from an existing app of the same kind.

## Background

Bin Finder and Ask Me Tomorrow were separate repositories until November 5, 2026; their history was brought over. The owner keeps a running list of app ideas in the Claude app. General-interest and family apps belong here; aircraft apps go in Aviation-Apps and cruise apps in Cruise-Apps.
