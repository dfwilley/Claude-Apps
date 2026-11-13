# Handoff note for Claude Code: Claude-Apps

Read this first, then `README.md`, which describes what each app does. This note covers how the owner works, how the repository is laid out, how changes reach his phone, and the traps.

## The owner and how to work with him

- The owner is not a programmer. Claude writes all the code. Explain things in plain language and define technical terms.
- He has a Windows PC and an iPhone. **There is no Mac.** Everything Apple-related is built on GitHub's cloud Macs (GitHub Actions). Never suggest opening Xcode.
- He has a paid Apple Developer account. Apps reach phones by TestFlight or by Sideloadly on the PC.
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
| `blue-book/` | Blue Book | `native/blue-book/`, web app inside a native shell |
| `hgvc-binder/` | HGVC Binder | `native/hgvc-binder/`, web app inside a native shell (TestFlight) |
| `bin-finder/` | Bin Finder | `native/bin-finder/`, separately written in SwiftUI |
| `job-jar/` | The Job Jar! | `native/job-jar/`, separately written in SwiftUI, iPhone and iPad (TestFlight) |

Two kinds of iPhone app live under `native/`:

- **Shells** (Blue Book, HGVC Binder): the app's `project.yml` bundles the web folder as-is and shows it in a web view, adding native extras such as Face ID or reminders. A change to the web folder changes the iPhone app too.
- **Separate native apps** (Bin Finder, The Job Jar!): the Swift code repeats the web app's rules. For example `native/job-jar/JobJar/Core.swift` must match `job-jar/core.js`, and Bin Finder's search tests use the same cases on both sides. **Change both sides together**, or the web and iPhone versions will behave differently.

Each native app is defined by a `project.yml` that XcodeGen turns into an Xcode project during the cloud build. Generated projects and `Info.plist` files are not checked in (see `.gitignore`).

## Tests

No install is needed. Run them with Node from the repository root:

```
node tests/bin-finder.test.js
node tests/blue-book.test.js
node tests/gate-time-puzzles.test.js
node tests/hgvc-binder.test.js
node tests/job-jar.test.js
node tests/who-was-here.test.js
```

All six passed on November 12, 2026. Knot of the Day, Wire Bender and Ask Me Tomorrow have no automated tests. The Swift unit tests and screenshot tests under `native/*/` need a Mac, so they run only in GitHub Actions.

## How a change reaches the phone

**A push to `main` is a release.** There is no staging step.

- The web apps go live on GitHub Pages as soon as they are pushed.
- Each `...-ios.yml` workflow runs when its app's files change: it runs the tests, builds an unsigned `.ipa`, and replaces the `<app>-latest` release (for Sideloadly).
- HGVC Binder and The Job Jar! also have `...-testflight.yml` workflows that sign and upload to TestFlight on every push that touches them. These **do not run the tests**, so a change with failing tests can still be uploaded. Check the test run before calling work finished.
- Signing uses four repository secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`. Never print or log them. The shared helper scripts are in `.github/scripts/`.
- Some workflows push screenshots to branches named `ci-screenshots-...`. Those branches are overwritten on every run; don't build on them.

For anything larger than a small fix, work on a branch and merge to `main` only when it is ready.

## Things that are easy to get wrong

- **Offline caching.** Every web app has a service worker (`sw.js`) with a named cache (for example `jj-v2`) and a list of files to keep for offline use. When you add, rename or remove a file the app needs, update that list, and raise the cache version so phones drop the old copy.
- **Bin Finder's About screen.** Each Bin Finder release needs a new entry in `CHANGES` in `bin-finder/app.js` and in `native/bin-finder/BinFinder/AboutView.swift`, with `VERSION` and `BUILD` in `app.js` matching `MARKETING_VERSION` in `project.yml` and the cache number in `sw.js`. `tests/bin-finder.test.js` fails if they drift.
- **Personal data never goes in this repository.** It is public. HGVC Binder reads its data file from the owner's Dropbox (layout in `hgvc-binder/DATA-FORMAT.md`). Blue Book, Bin Finder, Ask Me Tomorrow and The Job Jar! keep everything on the device. Test data must be made up.
- **Everything stays on the device** is a promise made in several apps' descriptions. Don't add analytics, accounts or cloud storage without the owner asking.
- The Job Jar! is used by young children. It links a kid's device to a grown-up's over home Wi-Fi only, with no internet or cloud. Keep it that way.
- Who Was Here uses live Wikidata, Wikipedia and OpenStreetMap services. Be gentle with request volume and keep the attribution.
- New web apps go in a new top-level folder and get a line in `README.md`. A native version goes under `native/<app>/` with its own workflows copied from an existing app of the same kind.

## Background

Bin Finder and Ask Me Tomorrow were separate repositories until November 5, 2026; their history was brought over. The owner keeps a running list of app ideas in the Claude app. General-interest and family apps belong here; aircraft apps go in Aviation-Apps and cruise apps in Cruise-Apps.
