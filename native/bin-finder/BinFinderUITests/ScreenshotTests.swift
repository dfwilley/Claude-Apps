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
        // Photos are read in the background, one at a time; results appear by themselves once this one is read.
        let foundByPhoto = app.staticTexts["Leveling blocks"].waitForExistence(timeout: 90)
        snap(app, "6-search-photo-word")

        if app.buttons["Cancel"].exists { app.buttons["Cancel"].firstMatch.tap(); sleep(1) }
        app.swipeUp(); sleep(1)
        app.staticTexts["Leveling blocks"].firstMatch.tap(); sleep(2)
        app.swipeUp(); sleep(1)
        snap(app, "7-leveling-blocks-detail")
        app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        app.swipeDown(); sleep(1)

        // Trip checklist
        let trip = app.buttons["tripChecklist"]
        if trip.waitForExistence(timeout: 3) {
            trip.tap(); sleep(1)
            if app.buttons["Gloves"].exists { app.buttons["Gloves"].tap(); sleep(1) }
            snap(app, "9-trip-checklist")
            app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        }
        // All items
        let items = app.buttons["allItems"]
        if items.waitForExistence(timeout: 3) {
            items.tap(); sleep(1)
            snap(app, "11-all-items")
            app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        }
        // A bin with a saved box inside it
        let rivets = app.staticTexts["Rivet supplies"].firstMatch
        if !rivets.exists { app.swipeUp(); sleep(1) }
        if rivets.waitForExistence(timeout: 3) {
            rivets.tap(); sleep(1)
            app.swipeUp(); sleep(1)
            snap(app, "12-bin-with-box-inside")
            app.navigationBars.buttons.firstMatch.tap(); sleep(1)
            app.swipeDown(); sleep(1)
        }
        // A place with places inside it
        let hangar = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Hangar'")).firstMatch
        if !hangar.exists { app.swipeUp(); sleep(1) }
        if hangar.waitForExistence(timeout: 3) {
            hangar.tap(); sleep(1)
            snap(app, "10-place-hangar")
            app.navigationBars.buttons.firstMatch.tap(); sleep(1)
        }
        app.swipeDown(); sleep(1)
        XCTAssertTrue(app.buttons["voiceSearch"].exists, "voice search button")

        let add = app.buttons["addBin"]
        if add.waitForExistence(timeout: 3) { add.tap(); sleep(1); snap(app, "8-new-bin") }
        XCTAssertTrue(foundByPhoto, "photo word search should find the leveling blocks bin")
    }
}
