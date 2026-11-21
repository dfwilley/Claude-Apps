import XCTest
@testable import BrickPile

final class BrickPileTests: XCTestCase {
    func testScreensAreInsideTheApp() throws {
        let dir = try XCTUnwrap(Bundle.main.url(forResource: "brick-pile", withExtension: nil))
        for f in ["index.html", "style.css", "core.js", "app.js", "icon.svg", "icons/icon-180.png"] {
            XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent(f).path), f)
        }
    }

    func testFileKinds() {
        XCTAssertEqual(SchemeHandler.mime(for: "js"), "text/javascript")
        XCTAssertEqual(SchemeHandler.mime(for: "HTML"), "text/html")
        XCTAssertEqual(SchemeHandler.mime(for: "svg"), "image/svg+xml")
        XCTAssertEqual(SchemeHandler.mime(for: "png"), "image/png")
    }

    func testTheCameraQuestionIsExplained() {
        let why = Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String
        XCTAssertFalse((why ?? "").isEmpty, "without this the app would close when the camera opens")
    }
}
