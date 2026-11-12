import Foundation
import UIKit

/// Keeps every bin in bins.json and photos as JPEG files, all inside the app's own folder on the phone.
final class BinStore: ObservableObject {
    @Published private(set) var bins: [Bin] = []
    /// Trip checklist marks (see TripList.keys). Kept until "Start a new trip".
    @Published private(set) var tripChecked: Set<String> = []

    let root: URL
    var photosDir: URL { root.appendingPathComponent("Photos", isDirectory: true) }
    var dataFile: URL { root.appendingPathComponent("bins.json") }
    var tripFile: URL { root.appendingPathComponent("trip.json") }
    private let thumbCache = NSCache<NSString, UIImage>()

    static func documents() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    init(root: URL) {
        self.root = root
        try? FileManager.default.createDirectory(at: photosDir, withIntermediateDirectories: true)
        load()
    }

    // MARK: Saving and loading

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; e.outputFormatting = [.prettyPrinted, .sortedKeys]; return e
    }()
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d
    }()

    func load() {
        guard let data = try? Data(contentsOf: dataFile),
              let list = try? Self.decoder.decode([Bin].self, from: data) else { bins = []; return }
        bins = list
        if let d = try? Data(contentsOf: tripFile), let keys = try? JSONDecoder().decode([String].self, from: d) { tripChecked = Set(keys) }
    }

    private func save() {
        if let data = try? Self.encoder.encode(bins) { try? data.write(to: dataFile, options: .atomic) }
    }

    // MARK: Bins

    func bin(_ id: UUID) -> Bin? { bins.first { $0.id == id } }

    /// Every place, including places that contain other places ("Hangar", "Hangar › Shelf 2").
    var locations: [String] { BinPlaces.all(bins) }

    /// Renames or moves a place; every bin inside it follows. Returns how many bins moved.
    @discardableResult
    func renamePlace(_ from: String, to: String) -> Int {
        let t = BinPlaces.tidy(to)
        guard !t.isEmpty else { return 0 }
        var n = 0
        for var b in bins where BinPlaces.isUnder(b.location, from) {
            b.location = BinPlaces.rename(b.location, from: from, to: t); upsert(b); n += 1
        }
        return n
    }

    // MARK: Trip checklist

    var tripBins: [Bin] { bins.filter(\.trip) }

    func setTrip(_ on: Bool, for id: UUID) {
        guard var b = bin(id), b.trip != on else { return }
        b.trip = on; upsert(b)
    }

    func setChecked(_ keys: [String], _ on: Bool) {
        for k in keys { if on { tripChecked.insert(k) } else { tripChecked.remove(k) } }
        saveTrip()
    }

    func startNewTrip() { tripChecked = []; saveTrip() }

    private func saveTrip() {
        if let d = try? JSONEncoder().encode(tripChecked.sorted()) { try? d.write(to: tripFile, options: .atomic) }
    }

    func nextCode(for location: String) -> String { BinCodes.next(for: location, existing: bins) }

    func upsert(_ bin: Bin) {
        var b = bin
        b.updated = Date()
        b.items = b.items.map(\.trimmed).filter { !$0.isEmpty }
        b.location = BinPlaces.tidy(b.location)
        b.kind = b.isBox ? "box" : "bin"
        if b.code.trimmed.isEmpty { b.code = nextCode(for: b.location) }
        if let i = bins.firstIndex(where: { $0.id == b.id }) { bins[i] = b } else { bins.append(b) }
        save()
    }

    func delete(_ id: UUID) {
        guard let b = bin(id) else { return }
        b.photos.forEach { try? FileManager.default.removeItem(at: photoURL($0)) }
        bins.removeAll { $0.id == id }
        save()
    }

    func addItem(_ text: String, to id: UUID) {
        let t = text.trimmed
        guard !t.isEmpty, var b = bin(id), !b.items.contains(where: { BinSearch.normalize($0) == BinSearch.normalize(t) }) else { return }
        b.items.append(t); upsert(b)
    }

    func removeItems(at offsets: IndexSet, from id: UUID) {
        guard var b = bin(id) else { return }
        b.items.remove(atOffsets: offsets); upsert(b)
    }

    func search(_ query: String) -> [SearchHit] { BinSearch.search(query, in: bins) }

    // MARK: Photos

    func photoURL(_ name: String) -> URL { photosDir.appendingPathComponent(name) }

    func image(_ name: String) -> UIImage? { UIImage(contentsOfFile: photoURL(name).path) }

    func thumbnail(_ name: String) -> UIImage? {
        if let t = thumbCache.object(forKey: name as NSString) { return t }
        guard let img = image(name) else { return nil }
        let t = img.preparingThumbnail(of: CGSize(width: 180, height: 180)) ?? img
        thumbCache.setObject(t, forKey: name as NSString)
        return t
    }

    /// Saves a photo (shrunk to at most 1,600 pixels) and then reads it for words in the background.
    @discardableResult
    func addPhoto(_ image: UIImage, to id: UUID, analyze: Bool = true) -> String? {
        guard var b = bin(id), let data = Self.jpeg(image) else { return nil }
        let name = UUID().uuidString + ".jpg"
        do { try data.write(to: photoURL(name), options: .atomic) } catch { return nil }
        b.photos.append(name)
        upsert(b)
        if analyze { analyzePhoto(name, of: id) }
        return name
    }

    func removePhoto(_ name: String, from id: UUID) {
        guard var b = bin(id) else { return }
        b.photos.removeAll { $0 == name }
        try? FileManager.default.removeItem(at: photoURL(name))
        thumbCache.removeObject(forKey: name as NSString)
        upsert(b)
    }

    /// Photos are read one at a time, in the background, so adding several at once doesn't bog the phone down.
    private let analysisQueue = DispatchQueue(label: "BinFinder.photo-reader", qos: .utility)

    func analyzePhoto(_ name: String, of id: UUID) {
        let url = photoURL(name)
        analysisQueue.async { [weak self] in
            guard let img = UIImage(contentsOfFile: url.path), let cg = img.cgImage else {
                NSLog("BinFinder photo reader: couldn't open %@", name); return
            }
            let words = PhotoAnalyzer.analyze(cg, orientation: CGImagePropertyOrientation(img.imageOrientation))
            NSLog("BinFinder photo reader: %d words from %@: %@", words.count, name, words.joined(separator: ", "))
            DispatchQueue.main.async { self?.addAutoWords(words, to: id) }
        }
    }

    func addAutoWords(_ words: [String], to id: UUID) {
        guard var b = bin(id), !words.isEmpty else { return }
        var seen = Set(b.autoWords.map(BinSearch.normalize))
        for w in words where !seen.contains(BinSearch.normalize(w)) { b.autoWords.append(w); seen.insert(BinSearch.normalize(w)) }
        b.autoWords = Array(b.autoWords.prefix(80))
        if let i = bins.firstIndex(where: { $0.id == id }) { bins[i] = b; save() }
    }

    static func jpeg(_ image: UIImage, maxSide: CGFloat = 1600) -> Data? {
        let size = image.size
        let scale = min(1, maxSide / max(size.width, size.height, 1))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.75)
    }

    // MARK: Backup

    /// Writes one backup file (bins plus photos) to a temporary folder and returns where it is.
    func makeBackup() throws -> URL {
        var photos: [String: Data] = [:]
        for b in bins { for p in b.photos { if let d = try? Data(contentsOf: photoURL(p)) { photos[p] = d } } }
        let file = BackupFile(bins: bins, photos: photos)
        let data = try Self.encoder.encode(file)
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Bin Finder Backup \(f.string(from: Date())).json")
        try data.write(to: url, options: .atomic)
        return url
    }

    /// Adds bins from a backup. A bin already on the phone is replaced only if the backup's copy is newer.
    /// Returns how many bins were added or updated.
    @discardableResult
    func restore(from url: URL) throws -> Int {
        let data = try Data(contentsOf: url)
        let file = try Self.decoder.decode(BackupFile.self, from: data)
        guard file.app == "bin-finder" else { throw NSError(domain: "BinFinder", code: 1, userInfo: [NSLocalizedDescriptionKey: "That file isn't a Bin Finder backup."]) }
        var changed = 0
        for b in file.bins {
            if let current = bin(b.id), current.updated >= b.updated { continue }
            for p in b.photos { if let d = file.photos[p] { try? d.write(to: photoURL(p), options: .atomic) } }
            if let i = bins.firstIndex(where: { $0.id == b.id }) { bins[i] = b } else { bins.append(b) }
            changed += 1
        }
        save()
        return changed
    }
}

/// Which bin the app is showing; set by tapping a bin or scanning its QR label.
final class Router: ObservableObject {
    @Published var path: [Route] = []
}
