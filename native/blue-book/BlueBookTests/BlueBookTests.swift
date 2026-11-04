import XCTest
import UIKit
@testable import BlueBook

final class BlueBookTests: XCTestCase {
    func testScreensAreInsideTheApp() throws {
        let dir = try XCTUnwrap(Bundle.main.url(forResource: "blue-book", withExtension: nil))
        for f in ["index.html", "style.css", "js/app.js", "js/extract.js", "js/career.js", "js/files.js", "js/export.js", "js/store.js", "vendor/jspdf.umd.min.js"] {
            XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent(f).path), f)
        }
    }

    func testPhotoNamesCannotLeaveTheFolder() {
        XCTAssertTrue(Library.isSafeId("pg-abc123_X"))
        XCTAssertFalse(Library.isSafeId("../bluebook"))
        XCTAssertFalse(Library.isSafeId("a/b"))
        XCTAssertFalse(Library.isSafeId(""))
        XCTAssertNil(Library.photoURL("../../x"))
    }

    func testSavesAndReadsTheLogbook() throws {
        try Library.writeDB("{\"version\":1,\"flights\":[]}")
        try Library.writeDB("{\"version\":1,\"flights\":[1]}")
        XCTAssertEqual(Library.readDB(), "{\"version\":1,\"flights\":[1]}")
        XCTAssertEqual(try String(contentsOf: Library.previousURL, encoding: .utf8), "{\"version\":1,\"flights\":[]}", "keeps the version before the last save")
        try Library.putPhoto("test-photo", data: Data([1, 2, 3]))
        XCTAssertTrue(FileManager.default.fileExists(atPath: Library.photoURL("test-photo")!.path))
        Library.deletePhoto("test-photo")
        XCTAssertFalse(FileManager.default.fileExists(atPath: Library.photoURL("test-photo")!.path))
    }

    func testReaderFindsWordsWithPositions() throws {
        let size = CGSize(width: 1600, height: 500)
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        let img = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill(); ctx.fill(CGRect(origin: .zero, size: size))
            let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 56), .foregroundColor: UIColor.black]
            ("16" as NSString).draw(at: CGPoint(x: 40, y: 100), withAttributes: attrs)
            ("AV-8B" as NSString).draw(at: CGPoint(x: 240, y: 100), withAttributes: attrs)
            ("163853" as NSString).draw(at: CGPoint(x: 600, y: 100), withAttributes: attrs)
            ("1.5" as NSString).draw(at: CGPoint(x: 1000, y: 100), withAttributes: attrs)
        }
        let words = try PageReader.read(img)
        let buno = try XCTUnwrap(words.first { $0.text.contains("163853") }, "read words: \(words.map(\.text))")
        XCTAssertGreaterThan(buno.x0, 0.3); XCTAssertLessThan(buno.x1, 0.65)
        XCTAssertLessThan(buno.y0, 0.5, "positions are measured from the top")
    }
}
