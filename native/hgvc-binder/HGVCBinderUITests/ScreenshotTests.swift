import XCTest

/// Opens the app, adds a sample property by hand, and saves a screenshot of each screen.
final class ScreenshotTests: XCTestCase {
    func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func testScreens() {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        XCTAssertTrue(web.staticTexts["Welcome to HGVC Binder"].waitForExistence(timeout: 20), "screens loaded inside the app")
        XCTAssertTrue(web.buttons["Choose my Dropbox data folder"].exists, "iPhone-only button shows, so the iPhone side is connected")
        sleep(1); snap(app, "1-welcome")

        web.buttons["Add a property by hand"].tap()
        let name = web.textFields["Resort name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap(); name.typeText("Sample Resort")
        let pts = web.textFields["Points each year"]
        if pts.exists { pts.tap(); pts.typeText("10000") }
        web.buttons["Save"].tap()
        sleep(1); snap(app, "2-points")
        for (tab, shot) in [("Fees", "3-fees"), ("Binder", "4-binder")] {
            let b = web.buttons[tab]
            if b.waitForExistence(timeout: 5) { b.tap(); sleep(1); snap(app, shot) }
        }
        let all = web.buttons["All Properties"]
        if all.waitForExistence(timeout: 5) { all.tap(); sleep(1); snap(app, "5-all") }
    }
}
