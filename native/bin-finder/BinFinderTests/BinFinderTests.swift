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

    func testSingularAndPluralFindEachOther() {
        let power = [Bin(name: "Power", location: "Garage", code: "G-09", items: ["AA batteries", "Hose clamps", "Paint brushes"])]
        for q in ["battery", "batteries", "aa battery", "clamp", "hose clamps", "brush", "brushes"] {
            XCTAssertEqual(BinSearch.search(q, in: power).count, 1, q)
        }
        XCTAssertEqual(BinSearch.search("butter", in: power).count, 0)
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

    func testSpokenSearches() {
        XCTAssertEqual(BinSearch.terms("Where's my spare fuses?"), ["spare", "fus"])
        XCTAssertEqual(BinSearch.search("where did I put the drill bits", in: sample).first?.bin.code, "G-02")
        XCTAssertEqual(BinSearch.search("Where's the sewer hose.", in: sample).first?.bin.code, "RR-01")
    }

    func testPlacesInsidePlaces() {
        XCTAssertEqual(BinPlaces.parts("Hangar > Shelf 2 /  Left"), ["Hangar", "Shelf 2", "Left"])
        XCTAssertEqual(BinPlaces.tidy(" RV/front bay "), "RV › front bay")
        XCTAssertTrue(BinPlaces.isUnder("Hangar › Shelf 2", "hangar"))
        XCTAssertFalse(BinPlaces.isUnder("Hangar Annex", "Hangar"))
        XCTAssertFalse(BinPlaces.isUnder("Hangar", "Hangar › Shelf 2"))
        XCTAssertEqual(BinCodes.prefix(for: "Hangar › Shelf 2"), "HS")
        XCTAssertEqual(BinCodes.prefix(for: "RV / Rear bay"), "RR")
        let nested = ["Hangar › Shelf 1", "Hangar › Shelf 2 › Left", "Hangar › Shelf 2", "Garage", ""].map { Bin(location: $0) }
        XCTAssertEqual(BinPlaces.all(nested), ["Garage", "Hangar", "Hangar › Shelf 1", "Hangar › Shelf 2", "Hangar › Shelf 2 › Left"])
        XCTAssertEqual(BinPlaces.children(of: "", in: nested).map { "\($0.name) \($0.count)" }, ["Garage 1", "Hangar 3"])
        XCTAssertEqual(BinPlaces.children(of: "Hangar", in: nested).map { "\($0.place) \($0.count)" }, ["Hangar › Shelf 1 1", "Hangar › Shelf 2 2"])
        XCTAssertEqual(BinPlaces.below("Hangar › Shelf 2 › Left", "Hangar"), "Shelf 2 › Left")
        XCTAssertEqual(BinPlaces.rename("RV Rear Bay › Left", from: "RV Rear Bay", to: "RV › Rear bay"), "RV › Rear bay › Left")
        XCTAssertEqual(BinPlaces.rename("Garage", from: "RV Rear Bay", to: "RV › Rear bay"), "Garage")
        XCTAssertEqual(BinSearch.search("shelf 2", in: [Bin(name: "Oil", location: "Hangar › Shelf 2", code: "HS-01")]).first?.reasons, ["Location: Hangar › Shelf 2"])
    }

    func testRenamePlaceMovesEveryBinInside() {
        let s = tempStore()
        s.upsert(Bin(name: "A", location: "RV Rear Bay"))
        s.upsert(Bin(name: "B", location: "RV Rear Bay / Left"))
        s.upsert(Bin(name: "C", location: "Garage"))
        XCTAssertEqual(s.renamePlace("RV Rear Bay", to: "RV / Rear bay"), 2)
        XCTAssertEqual(Set(s.bins.map(\.location)), ["RV › Rear bay", "RV › Rear bay › Left", "Garage"])
    }

    func testTripChecklistSavesAndResets() throws {
        let s = tempStore()
        s.upsert(Bin(name: "Sewer", location: "RV", items: ["Sewer hose", "Gloves"], trip: true))
        s.upsert(Bin(name: "Blocks", location: "RV"))
        let blocks = try XCTUnwrap(s.bins.first { $0.name == "Blocks" })
        s.setTrip(true, for: blocks.id)
        let sewer = try XCTUnwrap(s.bins.first { $0.name == "Sewer" })
        XCTAssertEqual(TripList.keys(sewer), ["\(sewer.id.uuidString)|Sewer hose", "\(sewer.id.uuidString)|Gloves"])
        s.setChecked(["\(sewer.id.uuidString)|Gloves", blocks.id.uuidString], true)
        let reopened = BinStore(root: s.root)
        let p = TripList.progress(reopened.bins, checked: reopened.tripChecked)
        XCTAssertEqual(p.done, 2); XCTAssertEqual(p.total, 3)
        reopened.startNewTrip()
        XCTAssertEqual(TripList.progress(BinStore(root: s.root).bins, checked: BinStore(root: s.root).tripChecked).done, 0)
    }

    func testTripFlagSurvivesBackupAndOldFiles() throws {
        let a = tempStore()
        a.upsert(Bin(name: "Trip", trip: true))
        let b = tempStore()
        try b.restore(from: try a.makeBackup())
        XCTAssertEqual(b.bins.first?.trip, true)
        let old = #"[{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","name":"Old"}]"#.data(using: .utf8)!
        let bins = try JSONDecoder().decode([Bin].self, from: old)
        XCTAssertEqual(bins.first?.trip, false)
    }

    func testItemParsing() {
        XCTAssertEqual(BinEditView.parseItems("zip ties, tape\n\n fuses ;wire"), ["zip ties", "tape", "fuses", "wire"])
    }
}
