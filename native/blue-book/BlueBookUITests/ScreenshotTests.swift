import XCTest

/// Opens the app and saves a screenshot of each section.
final class ScreenshotTests: XCTestCase {
    func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func testScreens() {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        XCTAssertTrue(web.staticTexts["Add logbook pages"].waitForExistence(timeout: 20), "screens loaded inside the app")
        XCTAssertTrue(web.buttons["Scan pages"].exists, "native scan button shows, so the iPhone side is connected")
        sleep(1); snap(app, "1-pages")
        for (tab, name) in [("Totals", "2-totals"), ("Timeline", "3-timeline"), ("Search", "4-search"), ("Export", "5-export")] {
            let b = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", tab)).firstMatch
            if b.waitForExistence(timeout: 5) { b.tap(); sleep(1); snap(app, name) }
        }
    }
}
