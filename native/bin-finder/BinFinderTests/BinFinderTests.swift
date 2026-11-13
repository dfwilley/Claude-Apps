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
        // Label codes: each type counted on its own within each location
        XCTAssertEqual(BinCodes.next(for: "Garage", existing: sample), "G-BIN-1")
        XCTAssertEqual(BinCodes.next(for: "Shed", kind: "box", existing: sample), "S-BOX-1")
        XCTAssertEqual(BinCodes.next(for: "Hangar", kind: "none", existing: sample), "H-4")
        let mixed = ["G-BIN-2", "g-bin-7", "G-BOX-3", "G-4", "GX-BIN-9", "G-BIN-X"].map { Bin(code: $0) }
        XCTAssertEqual(BinCodes.next(for: "Garage", kind: "bin", existing: mixed), "G-BIN-8")
        XCTAssertEqual(BinCodes.next(for: "Garage", kind: "box", existing: mixed), "G-BOX-4")
        XCTAssertEqual(BinCodes.next(for: "Garage", kind: "none", existing: mixed), "G-5")
        let day = { (n: Double) in Date(timeIntervalSince1970: 1_767_225_600 + n * 86_400) }
        let old = [Bin(location: "Garage", code: "G-02", created: day(1)), Bin(location: "Garage", code: "G-01", kind: "box", created: day(0)),
                   Bin(location: "Garage", code: "G-03", created: day(0)), Bin(location: "Hangar", code: "H-01", kind: "none", created: day(2)),
                   Bin(location: "Hangar › Shelf 2", code: "X", kind: "box", created: day(3))]
        let byID = Dictionary(uniqueKeysWithValues: old.map { ($0.id, $0.code) })
        XCTAssertEqual(BinCodes.renumber(old).map { "\(byID[$0.id]!)>\($0.code)" }, ["G-01>G-BOX-1", "G-03>G-BIN-1", "G-02>G-BIN-2", "H-01>H-1", "X>HS-BOX-1"])
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
        XCTAssertEqual(b.code, "G-BIN-1")
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
        // Location pull-downs on the main list
        XCTAssertEqual(BinPlaces.levels(for: "", in: nested).map { "\($0.parent)|\($0.selected)|\($0.choices.count)" }, ["||2"])
        XCTAssertEqual(BinPlaces.levels(for: "hangar", in: nested).map { "\($0.parent)|\($0.name)|\($0.selected)|\($0.choices.count)" }, ["||Hangar|2", "hangar|hangar||2"])
        XCTAssertEqual(BinPlaces.levels(for: "Hangar › Shelf 2", in: nested).map { "\($0.selected)|\($0.choices.map(\.name).joined(separator: ","))" },
                       ["Hangar|Garage,Hangar", "Hangar › Shelf 2|Shelf 1,Shelf 2", "|Left"])
        XCTAssertEqual(BinPlaces.levels(for: "Garage", in: nested).map(\.selected), ["Garage"])
        XCTAssertEqual(BinPlaces.nearest("hangar › shelf 2 › Right", in: nested), "Hangar › Shelf 2")
        XCTAssertEqual(BinPlaces.nearest("Shed › Top", in: nested), "")
        XCTAssertEqual(BinPlaces.nearest("", in: nested), "")
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

    func testBinOrBoxSurvivesBackupAndOldFiles() throws {
        let a = tempStore()
        a.upsert(Bin(name: "Lights", code: "G-07", kind: "box"))
        a.upsert(Bin(name: "", code: "G-08"))
        let b = tempStore()
        try b.restore(from: try a.makeBackup())
        XCTAssertEqual(b.bins.first { $0.code == "G-07" }?.kind, "box")
        XCTAssertEqual(b.bins.first { $0.code == "G-08" }?.displayName, "Bin G-08")
        XCTAssertEqual(Bin(name: " ", code: "G-09", kind: "box").displayName, "Box G-09")
        let shelf = Bin(name: "", code: "H-01", kind: "none")
        XCTAssertEqual(shelf.kind, "none"); XCTAssertEqual(shelf.kindWord, ""); XCTAssertEqual(shelf.kindLabel, "None"); XCTAssertEqual(shelf.displayName, "H-01")
        XCTAssertEqual(Bin(name: "Shelf 1", code: "H-01", kind: "none").displayName, "Shelf 1")
        XCTAssertEqual(Bin(kind: "crate").kindLabel, "Bin (plastic)")
        a.upsert(Bin(name: "Shelf 1", code: "H-01", kind: "none"))
        let c = tempStore()
        try c.restore(from: try a.makeBackup())
        XCTAssertEqual(c.bins.first { $0.code == "H-01" }?.kind, "none")
        let old = #"[{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","name":"Old"},{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FE","name":"Odd","kind":"crate"}]"#.data(using: .utf8)!
        XCTAssertEqual(try JSONDecoder().decode([Bin].self, from: old).map(\.kind), ["bin", "bin"])
    }

    func testAllItemsListIsAlphabeticalWithItsContainer() {
        XCTAssertEqual(BinSearch.allItems(Array(sample.prefix(2))).map { "\($0.item)|\($0.bin.code)" },
                       ["Cordless drill|G-02", "Electrical tape|G-01", "Fuses (ATC)|G-01", "Step bits|G-02", "Zip ties|G-01"])
        let mixed = [Bin(name: "B", code: "B-02", items: ["tape", " "]), Bin(name: "A", code: "B-01", items: ["Tape", "10 mm socket", "9 mm socket"])]
        XCTAssertEqual(BinSearch.allItems(mixed).map { "\($0.item)|\($0.bin.code)" },
                       ["9 mm socket|B-01", "10 mm socket|B-01", "Tape|B-01", "tape|B-02"])
    }

    func testBinsInsideBinsRules() {
        let shelf = Bin(name: "Shelf 1", location: "Hangar", code: "H-01")
        let kit = Bin(name: "Cowl Louver Kit", location: "Hangar", code: "H-02", items: ["Louvers", "Rivets"], kind: "box", inside: shelf.id)
        let bag = Bin(name: "Hardware bag", code: "H-03", items: ["Screws"], inside: kit.id)
        let lost = Bin(name: "Orphan", code: "H-04", inside: UUID())
        var me = Bin(name: "Self", code: "H-05"); me.inside = me.id
        let all = [shelf, kit, bag, lost, me]
        XCTAssertEqual(BinNesting.holder(of: kit, in: all)?.id, shelf.id)
        XCTAssertEqual(BinNesting.holder(of: bag, in: all)?.id, kit.id)
        XCTAssertNil(BinNesting.holder(of: shelf, in: all)); XCTAssertNil(BinNesting.holder(of: lost, in: all)); XCTAssertNil(BinNesting.holder(of: me, in: all))
        XCTAssertEqual(BinNesting.held(by: shelf, in: all).map(\.name), ["Cowl Louver Kit"])
        XCTAssertTrue(BinNesting.held(by: bag, in: all).isEmpty)
        XCTAssertTrue(BinNesting.canHold(shelf, lost, in: all)); XCTAssertTrue(BinNesting.canHold(bag, lost, in: all))
        XCTAssertFalse(BinNesting.canHold(shelf, shelf, in: all))
        XCTAssertFalse(BinNesting.canHold(kit, shelf, in: all))
        XCTAssertFalse(BinNesting.canHold(bag, shelf, in: all))
        XCTAssertEqual(BinSearch.search("rivets", in: all).first?.reasons, ["Item: Rivets", "In Shelf 1"])
        XCTAssertEqual(BinSearch.search("screws", in: all).first?.reasons, ["Item: Screws", "In Cowl Louver Kit"])
        XCTAssertEqual(BinSearch.search("shelf 1", in: all).map(\.bin.name), ["Shelf 1"])
    }

    func testPuttingABoxInsideABinMovesAndSurvivesBackup() throws {
        let s = tempStore()
        s.upsert(Bin(name: "Shelf 1", location: "Hangar", code: "H-01"))
        s.upsert(Bin(name: "Cowl Louver Kit", code: "B-01", items: ["Louvers"], kind: "box"))
        let shelf = try XCTUnwrap(s.bins.first { $0.code == "H-01" }), kit = try XCTUnwrap(s.bins.first { $0.code == "B-01" })
        XCTAssertEqual(s.canGoInside(shelf).map(\.name), ["Cowl Louver Kit"])
        s.put(kit.id, inside: shelf.id)
        XCTAssertEqual(s.bin(kit.id)?.location, "Hangar")
        XCTAssertEqual(s.held(by: shelf).map(\.name), ["Cowl Louver Kit"])
        XCTAssertTrue(s.canGoInside(shelf).isEmpty)
        s.put(shelf.id, inside: kit.id) // refused: the shelf can't go inside a box that's on it
        XCTAssertNil(s.bin(shelf.id)?.inside)
        var moved = try XCTUnwrap(s.bin(shelf.id)); moved.location = "Hangar / North wall"; s.upsert(moved)
        XCTAssertEqual(s.bin(kit.id)?.location, "Hangar › North wall")
        let b = tempStore()
        try b.restore(from: try s.makeBackup())
        XCTAssertEqual(b.bin(kit.id)?.inside, shelf.id)
        // A web backup writes "" for "not inside anything".
        let web = #"[{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","name":"Web","inside":""},{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FE","name":"Kid","inside":"6f9619ff-8b86-d011-b42d-00c04fc964ff"}]"#.data(using: .utf8)!
        let bins = try JSONDecoder().decode([Bin].self, from: web)
        XCTAssertNil(bins[0].inside); XCTAssertEqual(bins[1].inside, bins[0].id)
        s.put(kit.id, inside: nil)
        XCTAssertNil(s.bin(kit.id)?.inside)
        s.put(kit.id, inside: shelf.id); s.delete(shelf.id)
        XCTAssertNil(s.bin(kit.id)?.inside)
    }

    func testItemParsing() {
        XCTAssertEqual(BinEditView.parseItems("zip ties, tape\n\n fuses ;wire"), ["zip ties", "tape", "fuses", "wire"])
    }
}
