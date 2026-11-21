import XCTest

/// Opens the app and saves a screenshot of each screen. No picture is sent anywhere: the pile shown is made up.
final class ScreenshotTests: XCTestCase {
    func text(_ web: XCUIElement, _ part: String) -> XCUIElement {
        web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", part)).firstMatch
    }
    func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func testFirstRunAndSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetForUITest"]
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        XCTAssertTrue(text(web, "For the best count").waitForExistence(timeout: 20), "screens loaded inside the app")
        sleep(1); snap(app, "1-first-run")
        web.buttons["Settings"].tap()
        XCTAssertTrue(text(web, "Sharper counts with Claude").waitForExistence(timeout: 5))
        sleep(1); snap(app, "2-settings")
    }

    func testPileAndIdeas() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetForUITest", "-samplePile"]
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        XCTAssertTrue(text(web, "Your pile").waitForExistence(timeout: 20), "the saved pile is shown")
        XCTAssertTrue(text(web, "24 pieces").exists, "6 + 4 + 8 + 2 + 4 pieces")
        sleep(1); snap(app, "3-pile")
        web.buttons["One more red 2 x 4 brick"].tap()
        XCTAssertTrue(text(web, "25 pieces").waitForExistence(timeout: 5), "the + button works")
        // With no key, the ideas come from the built-in set and each has a picture.
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Show me ideas")).firstMatch.tap()
        XCTAssertTrue(text(web, "Build it layer by layer").waitForExistence(timeout: 5), "built-in ideas appear without a key")
        sleep(1); snap(app, "4-ideas")
    }
}
