import XCTest

/// Walks through the main screens with sample data and saves screenshots for review.
final class ScreenshotTests: XCTestCase {
    func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func testMainScreens() {
        continueAfterFailure = true
        let app = XCUIApplication()
        app.launchArguments = ["-demoData"]
        app.launch()
        XCTAssertTrue(app.navigationBars["Bin Finder"].waitForExistence(timeout: 10))
        sleep(4) // let the photo reader finish
        snap(app, "1-home")

        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap(); search.typeText("spare fuses")
        sleep(1)
        snap(app, "2-search-spare-fuses")

        if app.keyboards.buttons["search"].exists { app.keyboards.buttons["search"].tap() } else if app.keyboards.buttons["Search"].exists { app.keyboards.buttons["Search"].tap() }
        sleep(1)
        app.staticTexts["Electrical spares"].firstMatch.tap()
        sleep(2)
        snap(app, "3-bin-detail")
        app.swipeUp(); sleep(1)
        snap(app, "4-bin-detail-lower")

        let label = app.buttons["Show QR label"]
        if !label.exists { app.swipeUp(); sleep(1) }
        if label.waitForExistence(timeout: 3) { label.tap(); sleep(1); snap(app, "5-qr-label"); app.buttons["Done"].firstMatch.tap(); sleep(1) }

        // Back to the list and search for a word that appears only in a photo ("LEVELERS" is printed on the leveling-blocks photo).
        app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        let field = app.searchFields.firstMatch
        field.tap()
        if field.buttons["Clear text"].exists { field.buttons["Clear text"].tap() }
        field.typeText("levelers")
        sleep(1)
        snap(app, "6-search-photo-word")
        XCTAssertTrue(app.staticTexts["Leveling blocks"].exists, "photo word search should find the leveling blocks bin")

        if app.buttons["Cancel"].exists { app.buttons["Cancel"].firstMatch.tap(); sleep(1) }
        let add = app.buttons["addBin"]
        if add.waitForExistence(timeout: 3) { add.tap(); sleep(1); snap(app, "7-new-bin") }
    }
}
