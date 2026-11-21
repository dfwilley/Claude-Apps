import XCTest
import UIKit
@testable import JobJar

/// Same checks as tests/job-jar.test.js for the web app.
final class CoreTests: XCTestCase {
    func day(_ y: Int, _ m: Int, _ d: Int) -> Date { Calendar.current.date(from: DateComponents(year: y, month: m, day: d, hour: 9))! }

    func testDays() {
        let thu = day(2026, 11, 5)
        XCTAssertEqual(dayKey(thu), "2026-11-05")
        XCTAssertEqual(weekday(thu), 4)
        XCTAssertEqual(dayKey(weekStart(thu)), "2026-11-01")
        XCTAssertEqual(dayKey(addDays(thu, 30)), "2026-12-05")
        XCTAssertEqual(dayKey(parseDay("2026-03-08")), "2026-03-08")
    }

    func testChoresStarsRewards() {
        let thu = day(2026, 11, 5), fri = addDays(thu, 1)
        var s = AppData.starter()
        XCTAssertEqual(s.chores.count, 6)
        XCTAssertTrue(s.settings.needsApproval, "a new family starts with the grown-up check on")
        XCTAssertEqual(s.version, 2)
        s.settings.needsApproval = false   // first, the rules with the grown-up check turned off
        s.kids = [Kid(id: "a", name: "Ava", avatar: "🦊", color: "#f00"), Kid(id: "b", name: "Ben", avatar: "🐻", color: "#00f")]
        let bed = s.chores[0].id
        s.chores[5].kids = ["b"]; s.chores[5].days = [1, 3, 5]; s.chores[5].stars = 2
        let dog = s.chores[5].id

        XCTAssertEqual(s.choresFor("a", thu).count, 5)
        XCTAssertEqual(s.choresFor("b", thu).count, 5)
        XCTAssertEqual(s.choresFor("b", fri).count, 6)

        XCTAssertEqual(s.markDone("a", bed, thu), 1)
        XCTAssertEqual(s.markDone("a", bed, thu), 0)
        XCTAssertEqual(s.kid("a")?.stars, 1)
        XCTAssertEqual(s.status("b", bed, thu), .todo)
        XCTAssertEqual(s.status("a", bed, fri), .todo)

        XCTAssertEqual(s.undo("a", bed, thu), 1)
        XCTAssertEqual(s.kid("a")?.stars, 0)
        for item in s.choresFor("a", thu) { s.markDone("a", item.chore.id, thu) }
        XCTAssertEqual(s.kid("a")?.stars, 5)
        XCTAssertTrue(s.progress("a", thu).allDone)

        // Grown-up checks first
        s.settings.needsApproval = true
        XCTAssertEqual(s.markDone("b", dog, fri), 0)
        XCTAssertEqual(s.status("b", dog, fri), .waiting)
        s.markDone("b", bed, fri)
        XCTAssertEqual(s.waitingList().count, 2)
        XCTAssertEqual(s.approve("b", dog, "2026-11-06"), 2)
        XCTAssertEqual(s.approve("b", dog, "2026-11-06"), 0)
        s.reject("b", bed, "2026-11-06")
        XCTAssertTrue(s.waitingList().isEmpty)
        XCTAssertEqual(s.kid("b")?.stars, 2)
        s.settings.needsApproval = false

        // Rewards
        let story = s.rewards[0].id // 5 stars
        XCTAssertTrue(s.canAfford("a", story))
        XCTAssertTrue(s.redeem("a", story))
        XCTAssertEqual(s.kid("a")?.stars, 0)
        XCTAssertFalse(s.redeem("a", story))
        XCTAssertEqual(s.adjust("a", 3, reason: "Helped Grandma"), 3)
        XCTAssertEqual(s.adjust("a", -10), -3)
        XCTAssertEqual(s.kid("a")?.stars, 0)

        // Week chart
        let wk = s.weekChart("b", fri)
        XCTAssertEqual(wk.days.first, "2026-11-01")
        XCTAssertEqual(wk.rows.first { $0.chore.id == dog }?.cells, [.off, .todo, .off, .todo, .off, .done, .off])
        XCTAssertEqual(wk.rows.first { $0.chore.id == bed }?.cells[6], .future)
        XCTAssertEqual(wk.earned[5], 2)
        XCTAssertEqual(s.weekChart("a", thu).rows.count, 5)

        // Removing a kid
        s.removeKid("b")
        XCTAssertEqual(s.kids.count, 1)
        XCTAssertNil(s.done["2026-11-06"]?["b"])
        XCTAssertEqual(s.chores[5].kids, [])
    }

    func testWebBackupLoads() throws {
        // A backup made by the web app (no log ids, fractional stars, missing fields)
        let json = """
        {"version":1,"kids":[{"id":"k1","name":"Cy","avatar":"🐸","color":"#34C47C","stars":3.4}],
         "chores":[{"id":"c1","pic":"🛏️","name":"Make bed","stars":99,"days":[],"kids":[]}],
         "done":{"2026-11-05":{"k1":{"c1":"done"}}},
         "log":[{"t":"2026-11-05T14:00:00.000Z","kid":"k1","kind":"chore","text":"Make bed","pic":"🛏️","delta":1,"day":"2026-11-05"}],
         "settings":{"pin":"1234"},"setupDone":true}
        """
        let d = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        XCTAssertEqual(d.kids.first?.stars, 3)
        XCTAssertEqual(d.chores.first?.stars, maxPay) // capped at 20
        XCTAssertEqual(d.chores.first?.days, allDays)
        XCTAssertEqual(d.rewards.count, 4)
        XCTAssertEqual(d.settings.pin, "1234")
        XCTAssertTrue(d.settings.sound)
        XCTAssertTrue(d.settings.needsApproval, "the grown-up check is switched on once for older saves")
        XCTAssertEqual(d.version, 2)
        let off = try JSONDecoder().decode(AppData.self, from: Data(#"{"version":2,"settings":{"needsApproval":false}}"#.utf8))
        XCTAssertFalse(off.settings.needsApproval, "after that, a grown-up's choice to turn it off is kept")
        XCTAssertEqual(d.status("k1", "c1", parseDay("2026-11-05")), .done)
        XCTAssertNotNil(isoDate(d.log[0].t))
        // and round-trips
        let again = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(d))
        XCTAssertEqual(again, d)
    }

    func testMoney() {
        var s = Settings()
        XCTAssertFalse(s.money); XCTAssertEqual(s.coin, "nickel")
        XCTAssertEqual(s.amountText(3), "3 stars")
        s.money = true
        XCTAssertEqual(s.amountText(5), "25¢"); XCTAssertEqual(s.amountSpeech(5), "25 cents")
        XCTAssertEqual(s.coinCount(5), "5 nickels"); XCTAssertEqual(s.coinCount(1), "1 nickel")
        s.coin = "quarter"
        XCTAssertEqual(s.amountText(6), "$1.50"); XCTAssertEqual(s.amountSpeech(6), "1 dollar and 50 cents")
        s.coin = "penny"; XCTAssertEqual(s.coinCount(2), "2 pennies")
        s.coin = "dollar"; XCTAssertEqual(s.amountText(2), "$2.00"); XCTAssertEqual(s.amountSpeech(2), "2 dollars")
        XCTAssertEqual(money(0), "0¢"); XCTAssertEqual(money(-35), "−35¢"); XCTAssertEqual(money(1005), "$10.05")
        XCTAssertEqual(moneyWords(101), "1 dollar and 1 cent")
        XCTAssertLessThan(coinKind("dime").d, coinKind("penny").d)
        XCTAssertLessThan(coinKind("quarter").d, coinKind("half").d)
        let d = try? JSONDecoder().decode(AppData.self, from: Data(#"{"settings":{"money":true,"coin":"doubloon"},"chores":[{"name":"Big","stars":15},{"name":"Huge","stars":99}]}"#.utf8))
        XCTAssertEqual(d?.settings.money, true); XCTAssertEqual(d?.settings.coin, "nickel")
        XCTAssertEqual(d?.chores.map(\.stars), [15, 20])
    }

    func testPhotos() {
        let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        XCTAssertTrue(validPhoto(png))
        XCTAssertFalse(validPhoto("javascript:alert(1)"))
        XCTAssertFalse(validPhoto("data:text/html;base64,PGI+"))
        XCTAssertFalse(validPhoto("data:image/png;base64,AA\"onerror=\"x"))
        XCTAssertNotNil(imageFromPhoto(png))
        let big = UIGraphicsImageRenderer(size: CGSize(width: 600, height: 400)).image { c in UIColor.systemTeal.setFill(); c.fill(CGRect(x: 0, y: 0, width: 600, height: 400)) }
        let s = photoString(from: big.pngData()!)
        XCTAssertNotNil(s)
        XCTAssertEqual(imageFromPhoto(s!)?.size, CGSize(width: 256, height: 256))
        let d = try? JSONDecoder().decode(AppData.self, from: Data(#"{"kids":[{"name":"Pat","photo":"http://example.com/x.png"},{"name":"Sam","photo":"\#(png)"}]}"#.utf8))
        XCTAssertEqual(d?.kids[0].photo, "")
        XCTAssertEqual(d?.kids[1].photo, png)
    }

    func testHelpers() {
        XCTAssertEqual(starWord(1), "1 star")
        XCTAssertEqual(starWord(3), "3 stars")
        XCTAssertTrue(validPin("0420"))
        XCTAssertFalse(validPin("123"))
        XCTAssertFalse(validPin("12a4"))
        XCTAssertEqual(daysText([1, 2, 3, 4, 5]), "School days")
        XCTAssertEqual(daysText([6, 0]), "Weekends")
        XCTAssertGreaterThan(JarStore.chime([784, 1175], step: 0.11).count, 1000)
    }

    // MARK: special days, special chores, matching (the same cases as tests/job-jar.test.js)

    func plainFamily() -> AppData {
        var f = AppData.starter()
        f.settings.needsApproval = false
        f.kids = [Kid(id: "a", name: "Ava", avatar: "🦊", color: "#f00"), Kid(id: "b", name: "Ben", avatar: "🐻", color: "#00f")]
        return f
    }

    func testSpecialDays() throws {
        let thu = day(2026, 11, 5), fri = addDays(thu, 1), sat = addDays(thu, 2)
        var f = plainFamily()
        let c0 = f.chores[0].id, c1 = f.chores[1].id
        f.chores[1].stars = 3
        f.specials.append(SpecialDay(id: "s1", pic: "🎂", name: "Ava's birthday", date: "2020-11-05", yearly: true, times: 2, kids: ["a"]))
        XCTAssertEqual(f.times("a", thu), 2); XCTAssertEqual(f.times("b", thu), 1)
        XCTAssertEqual(f.times("a", fri), 1, "only on the day")
        XCTAssertEqual(f.special("a", thu)?.name, "Ava's birthday")
        XCTAssertEqual(f.pay("a", f.chores[1], thu), 6)
        XCTAssertEqual(f.markDone("a", c1, thu, now: thu), 6)
        XCTAssertEqual(f.markDone("b", c1, thu, now: thu), 3)
        XCTAssertEqual(f.kid("a")?.stars, 6)
        XCTAssertTrue(f.log.first { $0.kid == "a" }?.text.contains("×2 Ava's birthday") ?? false)
        XCTAssertEqual(f.undo("a", c1, thu), 6, "undo takes the doubled pay back")
        XCTAssertEqual(f.kid("a")?.stars, 0)
        f.specials.append(SpecialDay(id: "s2", pic: "🎉", name: "Snow day", date: "2026-11-05", yearly: false, times: 3))
        XCTAssertEqual(f.times("a", thu), 3); XCTAssertEqual(f.times("b", thu), 3)
        XCTAssertEqual(f.times("b", addDays(thu, 365)), 1, "a one-time day doesn't repeat")
        XCTAssertEqual(f.times("a", addDays(thu, 365)), 2, "the birthday comes back next year")
        // with the grown-up check on, the special day counts by the day the chore was done
        f.settings.needsApproval = true
        XCTAssertEqual(f.markDone("a", c0, thu, now: thu), 0)
        XCTAssertEqual(f.approve("a", c0, "2026-11-05", now: sat), 3)
        // loading: bad special days are dropped, the multiplier is kept between 2 and 3
        let ns = try JSONDecoder().decode(AppData.self, from: Data(#"{"specials":[{"name":"X","date":"soon"},{"name":"Y","date":"2026-12-25","times":9}]}"#.utf8))
        XCTAssertEqual(ns.specials.count, 1); XCTAssertEqual(ns.specials.first?.times, 3)
        let again = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(f))
        XCTAssertEqual(again, f, "special days are kept in a backup")
        f.removeKid("a")
        XCTAssertEqual(f.specials.map(\.id), ["s2"])
    }

    func testSpecialChore() throws {
        let thu = day(2026, 11, 5), sat = addDays(thu, 2)
        var f = plainFamily()
        let leaves = Chore(id: "lv", pic: "🍂", name: "Rake leaves", stars: 5, from: "2026-11-05", until: "2026-11-07")
        f.chores.append(leaves)
        XCTAssertFalse(AppData.isDue(leaves, addDays(thu, -1), "a")); XCTAssertTrue(AppData.isDue(leaves, thu, "a"))
        XCTAssertTrue(AppData.isDue(leaves, sat, "a")); XCTAssertFalse(AppData.isDue(leaves, addDays(sat, 1), "a"))
        XCTAssertEqual(f.choresFor("a", thu).count, 7); XCTAssertEqual(f.choresFor("a", addDays(sat, 1)).count, 6)
        XCTAssertEqual(f.weekChart("a", thu).rows.first { $0.chore.id == "lv" }?.cells, [.off, .off, .off, .off, .todo, .future, .future])
        let back = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(f))
        XCTAssertEqual(back.chore("lv")?.from, "2026-11-05"); XCTAssertEqual(back.chore("lv")?.until, "2026-11-07")
        let odd = try JSONDecoder().decode(AppData.self, from: Data(#"{"chores":[{"name":"X","from":"junk"}]}"#.utf8))
        XCTAssertEqual(odd.chores.first?.from, "")
    }

    func testMatching() throws {
        let thu = day(2026, 11, 5), fri = addDays(thu, 1), sat = addDays(thu, 2)
        var f = plainFamily()
        let c = f.chores.map(\.id)
        f.matches.append(MatchOffer(id: "m1", pic: "👵", who: "Grandma", percent: 50, kids: ["a"], until: "2026-11-06"))
        XCTAssertEqual(f.matchesFor("a", thu).count, 1); XCTAssertEqual(f.matchesFor("b", thu).count, 0)
        XCTAssertEqual(f.markDone("a", c[0], thu, now: thu), 1, "the chore itself still pays 1")
        XCTAssertEqual(f.kid("a")?.stars, 1, "half a star isn't given yet")
        f.markDone("a", c[1], thu, now: thu)
        XCTAssertEqual(f.kid("a")?.stars, 3, "2 earned, Grandma adds 1")
        XCTAssertEqual(f.log[0].kind, "match"); XCTAssertEqual(f.log[0].text, "Grandma's match"); XCTAssertEqual(f.log[0].delta, 1)
        XCTAssertEqual(f.matches[0].given["a"], 1); XCTAssertEqual(f.matches[0].earned["a"], 2)
        f.markDone("b", c[0], thu, now: thu)
        XCTAssertEqual(f.kid("b")?.stars, 1, "Ben isn't matched")
        XCTAssertEqual(f.weekChart("a", thu).earned[4], 3, "the week chart counts the match")
        f.undo("a", c[1], thu)
        XCTAssertEqual(f.kid("a")?.stars, 1); XCTAssertNil(f.matches[0].given["a"])
        f.markDone("a", c[1], thu, now: thu)
        XCTAssertEqual(f.kid("a")?.stars, 3)
        // after the last day of the match, nothing more is added
        f.markDone("a", c[0], sat, now: sat); f.markDone("a", c[1], sat, now: sat)
        XCTAssertEqual(f.kid("a")?.stars, 5)
        // a limit, and a 200% match
        f.matches.append(MatchOffer(id: "m2", pic: "👴", who: "Granddad", percent: 200, cap: 3))
        f.markDone("b", c[1], thu, now: thu)
        XCTAssertEqual(f.kid("b")?.stars, 4, "1 earned, Granddad adds 2")
        f.markDone("b", c[2], thu, now: thu)
        XCTAssertEqual(f.kid("b")?.stars, 6, "only 1 more: Granddad's limit is 3")
        f.markDone("b", c[3], thu, now: thu)
        XCTAssertEqual(f.kid("b")?.stars, 7, "the limit is reached")
        // a match and a special day together: the match counts the doubled pay
        f.specials.append(SpecialDay(id: "s", name: "Birthday", date: "2026-11-06", yearly: false, times: 2))
        f.matches.removeAll { $0.id == "m2" }
        let before = f.kid("a")!.stars
        f.markDone("a", c[0], fri, now: fri)
        XCTAssertEqual(f.kid("a")?.stars, before + 2 + 1, "2 for the chore, and Grandma's half of 2")
        // with the grown-up check on, the match is only added when the chore is OK'd
        f.settings.needsApproval = true
        let b2 = f.kid("a")!.stars
        f.markDone("a", c[1], fri, now: fri)
        XCTAssertEqual(f.kid("a")?.stars, b2)
        f.approve("a", c[1], "2026-11-06", now: sat)
        XCTAssertEqual(f.kid("a")?.stars, b2 + 2 + 1)
        // a backup keeps the running totals; odd values are tidied
        let back = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(f))
        XCTAssertEqual(back.matches, f.matches)
        let odd = try JSONDecoder().decode(AppData.self, from: Data(#"{"matches":[{"percent":"abc","cap":-4,"earned":{"a":2,"z":-1}}]}"#.utf8))
        XCTAssertEqual(odd.matches.first?.percent, 100); XCTAssertEqual(odd.matches.first?.cap, 0)
        XCTAssertEqual(odd.matches.first?.earned, ["a": 2]); XCTAssertEqual(odd.matches.first?.who, "Grandma")
        // a kid's device gets only its own kid's share of a match
        f.matches.append(MatchOffer(id: "m3", who: "Nana", percent: 100))
        f.settings.needsApproval = false
        f.markDone("b", c[4], fri, now: fri)
        let slice = f.slice(for: ["b"])
        XCTAssertEqual(slice.matches.map(\.id), ["m3"], "Grandma's match is only for Ava")
        XCTAssertEqual(slice.matches.first?.given.keys.sorted(), ["b"])
        f.removeKid("a")
        XCTAssertEqual(f.matches.map(\.id), ["m3"], "a match made only for a removed kid goes away")
    }

    func testOnceADayChore() throws {
        let thu = day(2026, 11, 5), fri = addDays(thu, 1)
        var f = plainFamily()
        let trash = Chore(id: "tr", pic: "🗑️", name: "Take out trash", stars: 2, once: true)
        f.chores.append(trash)
        XCTAssertEqual(f.choresFor("a", thu).count, 7); XCTAssertEqual(f.choresFor("b", thu).count, 7)
        XCTAssertNil(f.takenBy(trash, thu))
        XCTAssertEqual(f.markDone("b", "tr", thu, now: thu), 2)
        XCTAssertEqual(f.takenBy(trash, thu), "b")
        XCTAssertEqual(f.choresFor("a", thu).count, 6, "gone from Ava's list")
        XCTAssertEqual(f.choresFor("b", thu).first { $0.chore.id == "tr" }?.status, .done, "Ben still sees it, checked off")
        XCTAssertEqual(f.markDone("a", "tr", thu, now: thu), 0, "Ava can't also do it")
        XCTAssertEqual(f.kid("a")?.stars, 0)
        XCTAssertEqual(f.choresFor("a", fri).count, 7, "back the next day")
        XCTAssertEqual(f.weekChart("a", thu).rows.first { $0.chore.id == "tr" }?.cells[4], .off)
        XCTAssertEqual(f.weekChart("b", thu).rows.first { $0.chore.id == "tr" }?.cells[4], .done)
        // A kid's own device is told the chore is taken, without being told who by
        let avaDevice = f.slice(for: ["a"])
        XCTAssertEqual(avaDevice.taken["2026-11-05"], ["tr"])
        XCTAssertEqual(avaDevice.choresFor("a", thu).count, 6)
        var offline = avaDevice
        XCTAssertEqual(offline.apply(SyncOp("done", kid: "a", chore: "tr", day: "2026-11-05", t: thu)), 0)
        XCTAssertTrue(f.slice(for: ["b"]).taken.isEmpty, "Ben's own device just shows it done")
        // "Not done yet" gives it back to everyone
        f.undo("b", "tr", thu)
        XCTAssertEqual(f.choresFor("a", thu).count, 7)
        XCTAssertTrue(f.slice(for: ["a"]).taken.isEmpty)
        // with the grown-up check on, waiting for an OK already takes it; a "no" gives it back
        f.settings.needsApproval = true
        f.markDone("a", "tr", thu, now: thu)
        XCTAssertEqual(f.choresFor("b", thu).count, 6)
        f.reject("a", "tr", "2026-11-05")
        XCTAssertEqual(f.choresFor("b", thu).count, 7)
        // an ordinary chore is not affected, and the setting is kept in a backup
        f.markDone("a", f.chores[0].id, thu, now: thu)
        XCTAssertEqual(f.choresFor("b", thu).count, 7)
        let back = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(f))
        XCTAssertEqual(back.chore("tr")?.once, true); XCTAssertEqual(back.chores[0].once, false)
    }

    func testAnyEmoji() {
        XCTAssertEqual(pickEmoji("🦄"), "🦄"); XCTAssertEqual(pickEmoji("  🚀 "), "🚀")
        XCTAssertEqual(pickEmoji("🐶🐱"), "🐱", "the last one typed wins")
        XCTAssertEqual(pickEmoji("dog 🐕"), "🐕")
        XCTAssertNil(pickEmoji("abc")); XCTAssertNil(pickEmoji("12")); XCTAssertNil(pickEmoji(""))
        XCTAssertEqual(pickEmoji("👨‍👩‍👧"), "👨‍👩‍👧", "a family emoji stays in one piece")
        XCTAssertEqual(pickEmoji("👍🏽"), "👍🏽", "skin tone stays with its emoji")
        for list in [chorePics.map(\.0), rewardPics.map(\.0), avatars] { XCTAssertEqual(Set(list).count, list.count, "no picture twice in a list") }
        XCTAssertGreaterThanOrEqual(chorePics.count, 60); XCTAssertGreaterThanOrEqual(avatars.count, 60)
    }

    // MARK: linking a grown-up's device and a kid's device

    func family() -> (AppData, Date) {
        let thu = day(2026, 11, 5)
        var s = AppData.starter()
        s.settings.pin = "1234"
        s.settings.needsApproval = false
        s.kids = [Kid(id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 6, photo: ""), Kid(id: "b", name: "Ben", avatar: "🐻", color: "#00f", stars: 2)]
        s.chores[5].kids = ["b"]          // only Ben feeds the dog
        s.chores[4].kids = ["a", "b"]
        s.markDone("a", s.chores[0].id, thu, now: thu)
        s.markDone("b", s.chores[0].id, thu, now: thu)
        return (s, thu)
    }

    func testKidDeviceGetsOnlyItsOwnKid() {
        let (s, thu) = family()
        let k = s.slice(for: ["a"])
        XCTAssertEqual(k.kids.map(\.id), ["a"])
        XCTAssertEqual(k.settings.pin, "", "the grown-up PIN stays off the kid's device")
        XCTAssertTrue(k.setupDone)
        XCTAssertEqual(k.chores.count, 5, "no dog chore: that one is Ben's")
        XCTAssertEqual(k.chores.first { $0.id == s.chores[4].id }?.kids, ["a"])
        XCTAssertNil(k.done[dayKey(thu)]?["b"])
        XCTAssertEqual(k.status("a", s.chores[0].id, thu), .done)
        XCTAssertTrue(k.log.allSatisfy { $0.kid == "a" })
        XCTAssertEqual(k.log.count, 1)
        XCTAssertEqual(k.rewards, s.rewards)
        XCTAssertEqual(s.slice(for: ["a", "b"]).kids.count, 2)
        XCTAssertTrue(s.slice(for: []).kids.isEmpty)
    }

    func testKidActionsReachTheGrownUpsDevice() {
        let fam = family()
        var parent = fam.0
        let thu = fam.1
        var pc = SyncConfig()
        let dev = pc.link(deviceId: "ipad", name: "iPad", kidId: "a")
        XCTAssertFalse(pc.familyId.isEmpty)
        XCTAssertNotNil(pc.device("ipad", token: dev.token))
        XCTAssertNil(pc.device("ipad", token: "guess"))
        XCTAssertNil(pc.device("other", token: dev.token))

        // The kid's device, out of reach of the grown-up's device
        var kc = SyncConfig()
        kc.role = "kid"; kc.token = dev.token
        var kid = parent.slice(for: dev.kidIds)
        let teeth = parent.chores[1].id
        let op1 = SyncOp("done", kid: "a", chore: teeth, day: dayKey(thu), t: thu)
        XCTAssertEqual(kid.apply(op1), 1)
        kc.pending.append(op1)
        let op2 = SyncOp("picture", kid: "a", avatar: "🦄", photo: "")
        kid.apply(op2); kc.pending.append(op2)
        XCTAssertEqual(kid.kid("a")?.stars, 8)

        // Meanwhile the grown-up gives a bonus and adds a chore
        parent.adjust("a", 3, reason: "Helped")
        parent.chores.append(Chore(pic: "🪴", name: "Water plants"))

        // Fresh slice arrives before the actions are confirmed: nothing the kid did is lost
        kid = kc.merge(slice: parent.slice(for: dev.kidIds), acked: [])
        XCTAssertEqual(kid.kid("a")?.stars, 6 + 1 + 3 + 1)
        XCTAssertEqual(kid.status("a", teeth, thu), .done)
        XCTAssertEqual(kid.kid("a")?.avatar, "🦄")
        XCTAssertEqual(kid.chores.count, 6)
        XCTAssertEqual(kc.pending.count, 2)

        // The actions arrive (twice, as can happen on a shaky link) and are carried out once
        var acked = pc.receive(kc.pending, from: dev, into: &parent)
        acked = pc.receive(kc.pending, from: dev, into: &parent)
        XCTAssertEqual(acked.count, 2)
        XCTAssertEqual(parent.kid("a")?.stars, 6 + 1 + 3 + 1)
        XCTAssertEqual(parent.kid("a")?.avatar, "🦄")
        XCTAssertEqual(parent.status("a", teeth, thu), .done)
        kid = kc.merge(slice: parent.slice(for: dev.kidIds), acked: acked)
        XCTAssertTrue(kc.pending.isEmpty)
        XCTAssertEqual(kid, parent.slice(for: dev.kidIds), "both devices now agree")

        // A device can't act for a kid it isn't linked to
        _ = pc.receive([SyncOp("done", kid: "b", chore: teeth, day: dayKey(thu))], from: dev, into: &parent)
        XCTAssertEqual(parent.status("b", teeth, thu), .todo)

        // With "grown-up checks first" on, a chore from the kid's device waits for the grown-up
        parent.settings.needsApproval = true
        let toys = parent.chores[2].id
        _ = pc.receive([SyncOp("done", kid: "a", chore: toys, day: dayKey(thu))], from: dev, into: &parent)
        XCTAssertEqual(parent.status("a", toys, thu), .waiting)
        parent.approve("a", toys, dayKey(thu))
        XCTAssertEqual(parent.slice(for: ["a"]).status("a", toys, thu), .done)

        // A second kid on the same device
        let again = pc.link(deviceId: "ipad", name: "iPad", kidId: "b")
        XCTAssertEqual(again.kidIds, ["a", "b"])
        XCTAssertEqual(again.token, dev.token)
        XCTAssertEqual(pc.devices.count, 1)
    }

    func testAskingForARewardFromAKidsDevice() {
        var parent = family().0
        let story = parent.rewards[0].id   // costs 5
        let ice = parent.rewards[3].id     // costs 15
        XCTAssertFalse(parent.ask("a", ice), "not enough stars")
        XCTAssertEqual(parent.apply(SyncOp("ask", kid: "a", reward: story)), 0)
        XCTAssertTrue(parent.asked("a", story))
        XCTAssertFalse(parent.ask("a", story), "only asked once")
        XCTAssertEqual(parent.slice(for: ["a"]).requests.count, 1)
        XCTAssertTrue(parent.slice(for: ["b"]).requests.isEmpty)
        let before = parent.kid("a")!.stars
        XCTAssertTrue(parent.answer(parent.requests[0].id, yes: true))
        XCTAssertEqual(parent.kid("a")?.stars, before - 5)
        XCTAssertTrue(parent.requests.isEmpty)
        XCTAssertEqual(parent.log.first?.kind, "reward")

        parent.adjust("a", 10)
        let mid = parent.kid("a")!.stars
        XCTAssertTrue(parent.ask("a", story))
        XCTAssertFalse(parent.answer(parent.requests[0].id, yes: false))
        XCTAssertEqual(parent.kid("a")?.stars, mid, "saying no costs nothing")
        parent.ask("a", story)
        parent.apply(SyncOp("unask", kid: "a", reward: story))
        XCTAssertTrue(parent.requests.isEmpty)
        parent.ask("a", story)
        parent.removeKid("a")
        XCTAssertTrue(parent.requests.isEmpty)

        // Saved files from before linking existed still open
        let old = try? JSONDecoder().decode(SyncConfig.self, from: Data("{}".utf8))
        XCTAssertEqual(old?.role, "")
        XCTAssertFalse(old?.isKid ?? true)
        XCTAssertEqual(newPairCode().count, 6)
    }
}
