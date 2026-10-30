import XCTest
import UIKit
@testable import BinFinder

final class BinFinderTests: XCTestCase {
    private func tempStore() -> BinStore {
        BinStore(root: FileManager.default.temporaryDirectory.appendingPathComponent("t-\(UUID().uuidString)"))
    }

    private let sample: [Bin] = [
        Bin(name: "Electrical spares", location: "Garage", code: "G-01", items: ["Fuses (ATC)", "Zip ties", "Electrical tape"]),
        Bin(name: "Drill and bits", location: "Garage", code: "G-02", items: ["Cordless drill", "Step bits"]),
        Bin(name: "Sewer and water", location: "RV Rear Bay", code: "RR-01", items: ["Sewer hose", "Water pressure regulator"], autoWords: ["camco", "hose"]),
        Bin(name: "Batteries", location: "Hangar", code: "H-03", items: ["AA batteries", "CR2032"], notes: "Check the ELT battery date"),
    ]

    func testSpareFusesFindsFuseBinEvenWithoutTheWordSpare() {
        let hits = BinSearch.search("spare fuses", in: sample)
        XCTAssertEqual(hits.first?.bin.code, "G-01")
        XCTAssertEqual(hits.count, 1)
        XCTAssertTrue(hits[0].reasons.contains("Item: Fuses (ATC)"))
    }

    func testPluralsAndCase() {
        XCTAssertEqual(BinSearch.search("BATTERY", in: sample).first?.bin.code, "H-03")
        XCTAssertEqual(BinSearch.search("bit", in: sample).first?.bin.code, "G-02")
        XCTAssertEqual(BinSearch.stem("boxes"), "box")
        XCTAssertEqual(BinSearch.stem("glasses"), "glass")
        XCTAssertEqual(BinSearch.stem("batteries"), "battery")
        XCTAssertEqual(BinSearch.stem("ties"), "tie")
    }

    func testWordsSeenInPhotosAreSearchable() {
        let hits = BinSearch.search("camco", in: sample)
        XCTAssertEqual(hits.first?.bin.code, "RR-01")
        XCTAssertEqual(hits.first?.reasons, ["Seen in photo: camco"])
    }

    func testAllWordsBeatsSomeWords() {
        // "garage drill" matches G-02 on both words; G-01 only on "garage".
        let hits = BinSearch.search("garage drill", in: sample)
        XCTAssertEqual(hits.map(\.bin.code), ["G-02"])
    }

    func testLabelCodeNotesAndNoMatch() {
        XCTAssertEqual(BinSearch.search("rr-01", in: sample).first?.bin.code, "RR-01")
        XCTAssertEqual(BinSearch.search("ELT", in: sample).first?.bin.code, "H-03")
        XCTAssertTrue(BinSearch.search("snowboard", in: sample).isEmpty)
        XCTAssertTrue(BinSearch.search("   ", in: sample).isEmpty)
    }

    func testCodes() {
        XCTAssertEqual(BinCodes.prefix(for: "Garage"), "G")
        XCTAssertEqual(BinCodes.prefix(for: "RV Rear Bay"), "RR")
        XCTAssertEqual(BinCodes.prefix(for: ""), "B")
        XCTAssertEqual(BinCodes.next(for: "Garage", existing: sample), "G-03")
        XCTAssertEqual(BinCodes.next(for: "Shed", existing: sample), "S-01")
    }

    func testQRLinks() {
        let id = UUID()
        let url = BinLinks.url(for: id)
        XCTAssertEqual(BinLinks.binID(from: url), id)
        XCTAssertNil(BinLinks.binID(from: URL(string: "https://example.com/bin/\(id)")!))
        XCTAssertNotNil(Labels.qrImage(url.absoluteString))
    }

    func testStoreSavesItemsPhotosAndReloads() throws {
        let s = tempStore()
        var b = Bin(name: "Test", location: "Garage")
        s.upsert(b)
        b = try XCTUnwrap(s.bins.first)
        XCTAssertEqual(b.code, "G-01")
        s.addItem("  Spare fuses ", to: b.id)
        s.addItem("spare fuses", to: b.id) // duplicate ignored
        let img = DemoData.image(symbol: "bolt.fill", color: .orange, label: "FUSES")
        let photo = try XCTUnwrap(s.addPhoto(img, to: b.id, analyze: false))
        XCTAssertTrue(FileManager.default.fileExists(atPath: s.photoURL(photo).path))
        let reopened = BinStore(root: s.root)
        let r = try XCTUnwrap(reopened.bin(b.id))
        XCTAssertEqual(r.items, ["Spare fuses"])
        XCTAssertEqual(r.photos, [photo])
        XCTAssertNotNil(reopened.thumbnail(photo))
        reopened.delete(b.id)
        XCTAssertFalse(FileManager.default.fileExists(atPath: s.photoURL(photo).path))
        XCTAssertTrue(BinStore(root: s.root).bins.isEmpty)
    }

    func testBackupRestoresIntoEmptyStore() throws {
        let a = tempStore()
        DemoData.seed(a)
        let url = try a.makeBackup()
        let b = tempStore()
        XCTAssertEqual(try b.restore(from: url), 6)
        XCTAssertEqual(b.bins.count, 6)
        for bin in b.bins { for p in bin.photos { XCTAssertNotNil(b.image(p)) } }
        XCTAssertEqual(try b.restore(from: url), 0, "restoring twice changes nothing")
    }

    func testLabelPDFHasOnePagePerTenLabels() throws {
        let bins = (1...12).map { Bin(name: "Bin \($0)", location: "Garage", code: String(format: "G-%02d", $0)) }
        let data = Labels.pdf(for: bins)
        let doc = try XCTUnwrap(CGPDFDocument(CGDataProvider(data: data as CFData)!))
        XCTAssertEqual(doc.numberOfPages, 2)
        let one = try XCTUnwrap(CGPDFDocument(CGDataProvider(data: Labels.pdf(for: [bins[0]], startAt: 9) as CFData)!))
        XCTAssertEqual(one.numberOfPages, 1)
        XCTAssertEqual(Labels.labelRect(9).maxY, 36 + 5 * 144, accuracy: 0.01)
    }

    func testPhotoReaderFindsPrintedWord() {
        let img = DemoData.image(symbol: "bolt.fill", color: .orange, label: "FUSES")
        let words = PhotoAnalyzer.analyze(img.cgImage!, orientation: .up).map(BinSearch.normalize)
        XCTAssertTrue(words.contains("fuses"), "found: \(words)")
    }

    func testItemParsing() {
        XCTAssertEqual(BinEditView.parseItems("zip ties, tape\n\n fuses ;wire"), ["zip ties", "tape", "fuses", "wire"])
    }
}
