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
         "chores":[{"id":"c1","pic":"🛏️","name":"Make bed","stars":9,"days":[],"kids":[]}],
         "done":{"2026-11-05":{"k1":{"c1":"done"}}},
         "log":[{"t":"2026-11-05T14:00:00.000Z","kid":"k1","kind":"chore","text":"Make bed","pic":"🛏️","delta":1,"day":"2026-11-05"}],
         "settings":{"pin":"1234"},"setupDone":true}
        """
        let d = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        XCTAssertEqual(d.kids.first?.stars, 3)
        XCTAssertEqual(d.chores.first?.stars, 5)
        XCTAssertEqual(d.chores.first?.days, allDays)
        XCTAssertEqual(d.rewards.count, 4)
        XCTAssertEqual(d.settings.pin, "1234")
        XCTAssertTrue(d.settings.sound)
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
}
