import Foundation

/// One storage bin, shelf, drawer or RV compartment.
struct Bin: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var name: String = ""
    var location: String = ""
    /// Short label printed on the bin, e.g. "G-03".
    var code: String = ""
    var items: [String] = []
    var notes: String = ""
    /// Photo file names in the app's Photos folder.
    var photos: [String] = []
    /// Words the phone found in the photos (printed text and recognized objects). Searchable.
    var autoWords: [String] = []
    var created: Date = Date()
    var updated: Date = Date()

    var displayName: String { name.trimmingCharacters(in: .whitespaces).isEmpty ? "Bin \(code)" : name }

    init(id: UUID = UUID(), name: String = "", location: String = "", code: String = "", items: [String] = [],
         notes: String = "", photos: [String] = [], autoWords: [String] = [], created: Date = Date(), updated: Date = Date()) {
        self.id = id; self.name = name; self.location = location; self.code = code; self.items = items
        self.notes = notes; self.photos = photos; self.autoWords = autoWords; self.created = created; self.updated = updated
    }

    // Tolerant decoding so older or hand-edited files still open.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        location = try c.decodeIfPresent(String.self, forKey: .location) ?? ""
        code = try c.decodeIfPresent(String.self, forKey: .code) ?? ""
        items = try c.decodeIfPresent([String].self, forKey: .items) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        photos = try c.decodeIfPresent([String].self, forKey: .photos) ?? []
        autoWords = try c.decodeIfPresent([String].self, forKey: .autoWords) ?? []
        created = try c.decodeIfPresent(Date.self, forKey: .created) ?? Date()
        updated = try c.decodeIfPresent(Date.self, forKey: .updated) ?? Date()
    }
}

struct SearchHit: Identifiable {
    let bin: Bin
    let score: Int
    let matchedTerms: Int
    /// Plain-language reasons, e.g. "Item: Spare fuses (ATC)".
    let reasons: [String]
    var id: UUID { bin.id }
}

enum BinSearch {
    static func normalize(_ s: String) -> String {
        s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US")).lowercased()
    }

    /// Words that don't help find anything.
    static let stopWords: Set<String> = ["the", "a", "an", "my", "of", "for", "where", "is", "are", "and", "in", "on", "to", "some", "any", "with"]

    /// Crude plural handling: fuses→fus (matches "fuse"), boxes→box, batteries→battery, glasses→glass, bolts→bolt.
    static func stem(_ w: String) -> String {
        if w.count > 4, w.hasSuffix("ies") { return String(w.dropLast(3)) + "y" }
        if w.count > 4, w.hasSuffix("sses") { return String(w.dropLast(2)) }
        if w.count > 3, w.hasSuffix("es"),
           ["s", "x", "z", "ch", "sh"].contains(where: { String(w.dropLast(2)).hasSuffix($0) }) {
            return String(w.dropLast(2))
        }
        if w.count > 3, w.hasSuffix("s"), !w.hasSuffix("ss") { return String(w.dropLast()) }
        return w
    }

    static func terms(_ query: String) -> [String] {
        let words = normalize(query)
            .split(whereSeparator: { !($0.isLetter || $0.isNumber || $0 == "-" || $0 == ".") })
            .map(String.init)
            .filter { !$0.isEmpty }
        let useful = words.filter { !stopWords.contains($0) }
        return (useful.isEmpty ? words : useful).map(stem)
    }

    /// Finds bins for a query. If some bins match every word, only those are shown; otherwise the best partial matches.
    static func search(_ query: String, in bins: [Bin]) -> [SearchHit] {
        let ts = terms(query)
        guard !ts.isEmpty else { return [] }
        var hits: [SearchHit] = []
        for bin in bins {
            var score = 0, matched = 0
            var reasons: [String] = []
            func add(_ r: String) { if !reasons.contains(r) { reasons.append(r) } }
            for t in ts {
                if normalize(bin.name).contains(t) { score += 6; matched += 1; add("Name"); continue }
                if let item = bin.items.first(where: { normalize($0).contains(t) }) { score += 5; matched += 1; add("Item: \(item)"); continue }
                if normalize(bin.code).contains(t) { score += 5; matched += 1; add("Label \(bin.code)"); continue }
                if normalize(bin.location).contains(t) { score += 2; matched += 1; add("Location: \(bin.location)"); continue }
                if normalize(bin.notes).contains(t) { score += 2; matched += 1; add("Notes"); continue }
                if let w = bin.autoWords.first(where: { normalize($0).contains(t) }) { score += 1; matched += 1; add("Seen in photo: \(w)"); continue }
            }
            if matched > 0 { hits.append(SearchHit(bin: bin, score: score, matchedTerms: matched, reasons: reasons)) }
        }
        let best = hits.map(\.matchedTerms).max() ?? 0
        return hits.filter { $0.matchedTerms == best }
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.bin.displayName < $1.bin.displayName }
    }
}

enum BinCodes {
    /// "Garage" → "G", "RV Basement" → "RB", "" → "B".
    static func prefix(for location: String) -> String {
        let words = location.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        let letters = words.prefix(2).compactMap { $0.first }.map { String($0).uppercased() }
        return letters.isEmpty ? "B" : letters.joined()
    }

    static func next(for location: String, existing: [Bin]) -> String {
        let p = prefix(for: location)
        let used = existing.compactMap { b -> Int? in
            let parts = b.code.uppercased().split(separator: "-")
            guard parts.count == 2, String(parts[0]) == p else { return nil }
            return Int(parts[1])
        }
        return String(format: "%@-%02d", p, (used.max() ?? 0) + 1)
    }
}

enum BinLinks {
    /// What the QR label holds. Scanning it with the iPhone Camera opens the bin in the app.
    static func url(for id: UUID) -> URL { URL(string: "binfinder://bin/\(id.uuidString)")! }

    static func binID(from url: URL) -> UUID? {
        guard url.scheme?.lowercased() == "binfinder", url.host?.lowercased() == "bin" else { return nil }
        return UUID(uuidString: url.lastPathComponent)
    }
}

/// A single backup file: every bin plus every photo.
struct BackupFile: Codable {
    var app = "bin-finder"
    var version = 1
    var exported = Date()
    var bins: [Bin]
    var photos: [String: Data]
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
