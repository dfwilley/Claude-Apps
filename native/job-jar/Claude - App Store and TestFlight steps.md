# The Job Jar!: getting it onto TestFlight and the App Store

Written November 18, 2026. Everything here is done in a web browser on your PC at
https://appstoreconnect.apple.com (sign in with your Apple Developer account). No Mac is needed.

## What is already done in the app

- Bundle ID `com.dfwilley.jobjar`, version 1.0, for iPhone and iPad.
- App icon in the size Apple requires (1024 x 1024, no transparency).
- The "does this app use encryption" question is answered in the app (no), so Apple won't ask on each upload.
- The message Apple shows when the app first uses home Wi-Fi to link devices.
- A privacy file inside the app saying it does no tracking and collects no data.
- The cloud build signs and uploads the app by itself once the app record exists (step 1).
- Cloud screenshots are now taken on the largest iPhone and the 13-inch iPad, the two sizes the App Store asks for.

## Step 1. Create the app record (about 5 minutes, only you can do this)

1. Go to **Apps**, press the blue **+**, choose **New App**.
2. Fill in:
   - **Platforms:** iOS
   - **Name:** `The Job Jar!` (if Apple says the name is taken, try `The Job Jar: Chore Chart`)
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** choose `com.dfwilley.jobjar` from the list
   - **SKU:** `jobjar`
   - **User Access:** Full Access
3. Press **Create**.

Then tell Claude it's done. Claude starts the upload and watches it. About 5 to 30 minutes after an
upload finishes, the build appears under the **TestFlight** tab.

## Step 2. Test with TestFlight

1. In App Store Connect open the app, then the **TestFlight** tab.
2. Under **Internal Testing** press **+**, name the group (for example `Family`), and add yourself.
   Internal testers must first be added as users of your developer account under **Users and Access**.
3. On the iPhone or iPad, install the free **TestFlight** app from the App Store, sign in with the
   same Apple ID, and install The Job Jar! from there.

Things to know:

- A TestFlight build stops opening 90 days after it was uploaded. A new upload resets that.
- TestFlight is for people 13 and older. On a device signed in with a child's Apple ID it may not be
  offered. If so, keep using Sideloadly for that device until the app is on the App Store.
- Testing with people outside your developer account ("External Testing") needs a quick review by
  Apple first, and the privacy policy link from step 4.

## Step 3. The App Store page: text you can paste

**Subtitle** (30 characters at most)

    Picture chore chart for kids

**Promotional text**

    Kids tap a picture when a chore is done. Stars or coins fill their jar and buy rewards your family picks.

**Description**

    The Job Jar! is a picture chore chart for kids about 4 to 8, including kids who can't read yet.

    Each child taps their own picture, then taps a chore when it's done. Every chore has a big picture
    and can be read out loud. Finished chores earn stars, and stars buy rewards your family chooses,
    like extra story time or an ice cream trip.

    FOR KIDS
    • Big pictures, big buttons, cheerful sounds
    • Their own picture or photo, and their own jar
    • A week chart that shows what they did each day

    FOR GROWN-UPS
    • A 4-number PIN keeps settings and rewards for grown-ups
    • Check each chore before the stars go in the jar
    • Choose which days and which kids each chore is for
    • Pay in stars, or in real coins your child can count: pennies, nickels, dimes, quarters
    • Special days such as birthdays, when chores pay double or triple
    • Special chores that show up only for a few days
    • Matching: when Grandma or Granddad offers to match what a child earns, the app adds their share and keeps count
    • History of everything earned and spent
    • Backup to a file

    A KID'S OWN DEVICE
    A child's iPad or iPhone can be linked to a grown-up's device with a 6-number code. It shows only
    that child's chart and stays in step over your home Wi-Fi.

    PRIVATE BY DESIGN
    No accounts, no ads, no tracking. Everything stays on your devices. Nothing is sent over the internet.

**Keywords** (100 characters at most)

    chore,chart,kids,allowance,reward,stars,jobs,family,routine,responsibility,money,coins,preschool

**Support URL**

    https://dfwilley.github.io/Claude-Apps/job-jar/

**Category:** Primary: Lifestyle. Secondary: Education.

**Price:** Free.

**Copyright:** `2026` followed by your name as you want it shown.

## Step 4. Privacy

- **App Privacy** section: choose **"No, we do not collect data from this app."** That is true: the
  app has no accounts, no analytics, and makes no internet connections.
- **Privacy Policy URL:** Apple requires one for every app. There is no page yet. Claude can add a
  short one at `https://dfwilley.github.io/Claude-Apps/job-jar/privacy.html` when you say so. It
  would say, in plain words:
  - The app collects nothing and sends nothing over the internet.
  - Names, pictures, chores and totals stay on the device, and are removed by deleting the app.
  - Linking a kid's device works only over the home Wi-Fi, directly between the two devices.
  - How to contact you. You need to choose a contact (an email address you are happy to make public,
    or the GitHub page).

## Step 5. Age rating and the Kids choice

- **Age rating questions:** answer **None** / **No** to every content question. The result should be 4+.
- **"Made for Kids":** this is your decision, and it can't be undone once the app is approved.
  - If you choose it, the app is listed in the Kids category for an age band (5 and under, or 6 to 8),
    and Apple reviews it more strictly. The app already follows the main rules: no ads, no tracking,
    no links out, and grown-up areas are behind a PIN.
  - If you leave it off, the app is listed like any family app in Lifestyle. This is the simpler path
    for a first submission. Claude's suggestion: leave it off for version 1.0.

## Step 6. Screenshots

Apple needs screenshots for two sizes:

| Slot in App Store Connect | Size in pixels |
|---|---|
| iPhone 6.9-inch display | 1320 x 2868 |
| iPad 13-inch display | 2064 x 2752 |

Each cloud build saves screenshots of every screen, using a made-up family. Ask Claude for a set
picked out for the App Store (3 to 6 for each size is plenty): for example the home screen, a kid's
chores, the "Great job!" moment, the prizes, the week chart, and money mode.

## Step 7. Send it to Apple

1. On the app's page, under the version **1.0**, scroll to **Build**, press **+** and choose the
   build that TestFlight shows.
2. Fill in **App Review Information**: your name, phone and email (only Apple sees these).
   In **Notes** you can paste:

       The grown-up PIN is chosen on first launch; there is no sign-in. To see the device-linking
       feature you need two devices on the same Wi-Fi: on one choose "Grown-ups > Devices > Link a
       kid's device", on the other choose "This is a kid's device" on the welcome screen and type the
       6-number code. The app makes no internet connections.

3. Press **Add for Review**, then **Submit**. Apple usually answers within a day or two.

## Before submitting: things not yet proven

- Linking a grown-up's device and a kid's device has never been tried on two real devices. Try it
  from TestFlight first. Apple's reviewer may try it too.
- Special days, special chores and matching have been tested on simulators only.
