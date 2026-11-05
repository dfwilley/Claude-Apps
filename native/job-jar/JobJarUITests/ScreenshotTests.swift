import XCTest

/// Walks through the main screens with a made-up family and saves screenshots for review.
final class ScreenshotTests: XCTestCase {
    func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func pin(_ app: XCUIApplication, _ digits: String) {
        for d in digits { app.buttons["pin-\(d)"].tap() }
        sleep(1)
    }

    func testMainScreens() {
        continueAfterFailure = true
        let app = XCUIApplication()
        app.launchArguments = ["-demoData"]
        app.launch()

        let ava = app.buttons["kid-Ava"]
        XCTAssertTrue(ava.waitForExistence(timeout: 10))
        snap(app, "1-home")

        ava.tap(); sleep(1)
        snap(app, "2-ava-today")

        let toys = app.descendants(matching: .any)["chore-Pick up toys"]
        XCTAssertTrue(toys.waitForExistence(timeout: 5))
        toys.tap()
        usleep(400_000)
        snap(app, "3-great-job")
        sleep(2)

        app.buttons["tab-Prizes"].tap(); sleep(1)
        snap(app, "4-prizes")

        let get = app.buttons["get-Extra story time"]
        if get.waitForExistence(timeout: 3) {
            get.tap(); sleep(1)
            snap(app, "5-pin-pad")
            pin(app, "1234")
            usleep(300_000)
            snap(app, "6-reward")
            sleep(3)
        }

        app.buttons["tab-My week"].tap(); sleep(1)
        snap(app, "7-week")

        app.buttons["tab-Today"].tap(); sleep(1)
        app.buttons["home"].tap(); sleep(1)
        app.buttons["grownups"].tap(); sleep(1)
        pin(app, "1234")
        snap(app, "8-grownups-kids")

        app.buttons["gu-chores"].tap(); sleep(1)
        snap(app, "9-grownups-chores")
        app.staticTexts["Feed the dog"].firstMatch.tap(); sleep(1)
        snap(app, "10-edit-chore")
        app.buttons["Cancel"].firstMatch.tap(); sleep(1)

        app.buttons["gu-history"].tap(); sleep(1)
        snap(app, "11-history")

        app.buttons["gu-settings"].tap(); sleep(1)
        snap(app, "12-settings")
        let approval = app.switches["needsApproval"]
        if approval.waitForExistence(timeout: 3) { approval.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap() }
        sleep(1)
        app.buttons["guDone"].tap(); sleep(1)

        app.buttons["kid-Ben"].tap(); sleep(1)
        app.descendants(matching: .any)["chore-Make bed"].tap()
        sleep(2)
        snap(app, "13-ben-waiting")

        app.buttons["home"].tap(); sleep(1)
        app.buttons["grownups"].tap(); sleep(1)
        pin(app, "1234")
        snap(app, "14-check")
        if app.buttons["approve"].firstMatch.waitForExistence(timeout: 3) { app.buttons["approve"].firstMatch.tap(); sleep(1) }
        snap(app, "15-checked")

        // Money mode: nickels, and Make bed pays 5 of them (25¢)
        app.buttons["gu-settings"].tap(); sleep(1)
        let money = app.switches["moneyMode"]
        if money.waitForExistence(timeout: 3) { money.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap(); sleep(1) }
        if app.buttons["coin-nickel"].waitForExistence(timeout: 3) { app.buttons["coin-nickel"].tap() }
        // turn checking off again so chores pay right away
        let approval = app.switches["needsApproval"]
        if !approval.isHittable { app.swipeUp(); sleep(1) }
        if approval.waitForExistence(timeout: 3) { approval.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap() }
        app.swipeDown(); app.swipeDown(); sleep(1)
        snap(app, "16-money-settings")
        app.buttons["gu-chores"].tap(); sleep(1)
        app.staticTexts["Make bed"].firstMatch.tap(); sleep(1)
        let inc = app.buttons["Increment"].firstMatch
        if inc.waitForExistence(timeout: 3) { for _ in 0..<4 { inc.tap() } }
        sleep(1)
        snap(app, "17-chore-pays-nickels")
        app.buttons["Save"].firstMatch.tap(); sleep(1)
        app.buttons["guDone"].tap(); sleep(1)
        snap(app, "18-home-money")
        app.buttons["kid-Ben"].tap(); sleep(1)
        snap(app, "19-ben-money")
        app.descendants(matching: .any)["chore-Make bed"].tap(); usleep(400_000)
        snap(app, "20-earned-25c")
        sleep(3)
        app.buttons["home"].tap(); sleep(1)
        app.buttons["kid-Ava"].tap(); sleep(1)
        app.buttons["myPicture"].tap(); sleep(1)
        snap(app, "21-pick-my-picture")
    }

    func testWelcome() {
        let app = XCUIApplication()
        app.launchArguments = ["-freshStart"]
        app.launch()
        XCTAssertTrue(app.buttons["start"].waitForExistence(timeout: 10))
        snap(app, "0-welcome")
        app.buttons["start"].tap(); sleep(1)
        pin(app, "2468"); pin(app, "2468")
        sleep(1)
        let name = app.textFields["kidName"]
        if name.waitForExistence(timeout: 5) {
            name.tap(); name.typeText("Mia")
            snap(app, "0-add-kid")
            app.buttons["saveKid"].tap(); sleep(1)
        }
        app.buttons["guDone"].tap(); sleep(1)
        XCTAssertTrue(app.buttons["kid-Mia"].waitForExistence(timeout: 5))
        snap(app, "0-first-home")
    }
}
