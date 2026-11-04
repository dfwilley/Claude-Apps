import XCTest
@testable import HGVCBinder

final class HGVCBinderTests: XCTestCase {
    func testScreensAreInsideTheApp() throws {
        let dir = try XCTUnwrap(Bundle.main.url(forResource: "hgvc-binder", withExtension: nil))
        for f in ["index.html", "style.css", "js/core.js", "js/store.js", "js/app.js", "icon.svg", "icon-180.png"] {
            XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent(f).path), f)
        }
    }

    func testNamesCannotLeaveTheFolder() {
        XCTAssertTrue(Library.isSafeId("abc123_X-1"))
        XCTAssertFalse(Library.isSafeId("../binder"))
        XCTAssertFalse(Library.isSafeId("a/b"))
        XCTAssertFalse(Library.isSafeId(""))
        XCTAssertNil(Library.docURL("../../x"))
        XCTAssertFalse(Vault.isSafeKey("../x"))
        XCTAssertTrue(Vault.isSafeKey("kings-land.contract"))
    }

    override func tearDown() {
        // Leave no test data behind for the screenshot run.
        try? FileManager.default.removeItem(at: Library.dbURL)
        try? FileManager.default.removeItem(at: Library.previousURL)
        super.tearDown()
    }

    func testSavesAndReadsTheBinder() throws {
        try Library.writeDB("{\"schema\":1,\"properties\":[]}")
        try Library.writeDB("{\"schema\":1,\"properties\":[1]}")
        XCTAssertEqual(Library.readDB(), "{\"schema\":1,\"properties\":[1]}")
        XCTAssertEqual(try String(contentsOf: Library.previousURL, encoding: .utf8), "{\"schema\":1,\"properties\":[]}")
    }

    func testKeepsAndRemovesDocuments() throws {
        try Library.putDoc("test-doc", data: Data([37, 80, 68, 70]))
        XCTAssertEqual(try Library.getDoc("test-doc"), Data([37, 80, 68, 70]))
        let copy = try Library.viewableCopy("test-doc", name: "2027 statement", mime: "application/pdf")
        XCTAssertEqual(copy.lastPathComponent, "2027 statement.pdf")
        Library.deleteDoc("test-doc")
        XCTAssertThrowsError(try Library.getDoc("test-doc"))
    }

    func testKeychainHoldsFullNumbers() throws {
        do { try Vault.set("test-prop.contract", "12-345678") } catch {
            // Unsigned simulator builds have no Keychain access (-34018). Sideloaded, signed builds do.
            if "\(error)".contains("-34018") { throw XCTSkip("No Keychain in an unsigned simulator build") }
            throw error
        }
        XCTAssertEqual(Vault.get("test-prop.contract"), "12-345678")
        try Vault.set("test-prop.contract", "")
        XCTAssertNil(Vault.get("test-prop.contract"))
    }

    func testPicksTheNewestDataFile() {
        let names = ["Claude - HGVC Binder Data 2026-11-03 0600.json", "notes.txt", "HGVC Binder Data 2026-11-04 0600.json", "Claude - HGVC Binder Data 2026-12-02 0447.json", "Hangar Log Data 2026-12-05.json"]
        XCTAssertEqual(DataFolder.newest(in: names), "Claude - HGVC Binder Data 2026-12-02 0447.json")
        XCTAssertNil(DataFolder.newest(in: ["other.json"]))
    }

    func testReadsReminderList() {
        let items = Notifier.parse([["id": "fee|x|2027-01-01|30", "fire": "2026-12-02", "hour": 9, "title": "Fee due in 30 days", "body": "Kings' Land"], ["bad": 1]])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].fire.year, 2026); XCTAssertEqual(items[0].fire.month, 12); XCTAssertEqual(items[0].fire.day, 2); XCTAssertEqual(items[0].fire.hour, 9)
    }

    func testServesScriptsWithTheRightType() {
        XCTAssertEqual(SchemeHandler.mime(for: "mjs"), "text/javascript")
        XCTAssertEqual(SchemeHandler.mime(for: "css"), "text/css")
        XCTAssertEqual(SchemeHandler.mime(for: "svg"), "image/svg+xml")
    }
}
