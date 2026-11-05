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
    /// On the trip checklist (things that get loaded for an RV trip).
    var trip: Bool = false
    var created: Date = Date()
    var updated: Date = Date()

    var displayName: String { name.trimmingCharacters(in: .whitespaces).isEmpty ? "Bin \(code)" : name }

    init(id: UUID = UUID(), name: String = "", location: String = "", code: String = "", items: [String] = [],
         notes: String = "", photos: [String] = [], autoWords: [String] = [], trip: Bool = false, created: Date = Date(), updated: Date = Date()) {
        self.id = id; self.name = name; self.location = location; self.code = code; self.items = items
        self.notes = notes; self.photos = photos; self.autoWords = autoWords; self.trip = trip; self.created = created; self.updated = updated
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
        trip = try c.decodeIfPresent(Bool.self, forKey: .trip) ?? false
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
    /// Includes the filler words people say out loud ("where did I put the spare fuses").
    static let stopWords: Set<String> = ["the", "a", "an", "my", "of", "for", "where", "is", "are", "and", "in", "on", "to", "some", "any", "with",
                                         "wheres", "find", "i", "im", "need", "looking", "did", "put", "we", "our", "it", "at", "please", "show", "me", "keep", "do", "have"]

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
        let words = normalize(query).replacingOccurrences(of: "'", with: "").replacingOccurrences(of: "’", with: "")
            .split(whereSeparator: { !($0.isLetter || $0.isNumber || $0 == "-" || $0 == ".") })
            .map { String($0).trimmingCharacters(in: CharacterSet(charactersIn: ".-")) }
            .filter { !$0.isEmpty }
        // Single letters (left over from "where's") would match nearly everything; single digits are kept ("shelf 2").
        let useful = words.filter { !stopWords.contains($0) && ($0.count > 1 || $0.contains(where: \.isNumber)) }
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
    /// "Garage" → "G", "RV Basement" → "RB", "Hangar › Shelf 2" → "HS", "" → "B".
    static func prefix(for location: String) -> String {
        let parts = BinPlaces.parts(location)
        let words: [Substring] = parts.count >= 2
            ? parts.prefix(2).compactMap { $0.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).first }
            : (parts.first ?? "").split(whereSeparator: { !$0.isLetter && !$0.isNumber })
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

/// Places inside places: "Hangar › Shelf 2 › Left". Typed as ›, > or /. Same rules as the web version (docs/search.js).
enum BinPlaces {
    static func parts(_ location: String) -> [String] {
        location.split(whereSeparator: { "›>/\\".contains($0) })
            .map { $0.split(whereSeparator: \.isWhitespace).joined(separator: " ") }
            .filter { !$0.isEmpty }
    }
    static func tidy(_ location: String) -> String { parts(location).joined(separator: " › ") }
    private static func same(_ a: String, _ b: String) -> Bool { BinSearch.normalize(a) == BinSearch.normalize(b) }
    /// Is this location the place itself or somewhere inside it?
    static func isUnder(_ location: String, _ place: String) -> Bool {
        let l = parts(location), p = parts(place)
        return !p.isEmpty && l.count >= p.count && zip(p, l).allSatisfy { same($0, $1) }
    }
    static func top(_ location: String) -> String { parts(location).first ?? "" }
    /// Every place and every place that contains one.
    static func all(_ bins: [Bin]) -> [String] {
        var seen: [String: String] = [:]
        for b in bins {
            let ps = parts(b.location)
            for i in stride(from: 1, through: ps.count, by: 1) {
                let p = ps.prefix(i).joined(separator: " › ")
                if seen[BinSearch.normalize(p)] == nil { seen[BinSearch.normalize(p)] = p }
            }
        }
        return seen.values.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }
    struct Child: Hashable { let place: String; let name: String; var count: Int }
    /// Places one level inside `place` ("" = top level), with how many bins are in each.
    static func children(of place: String, in bins: [Bin]) -> [Child] {
        let depth = parts(place).count
        var out: [String: Child] = [:]
        for b in bins {
            let ps = parts(b.location)
            guard ps.count > depth, depth == 0 || isUnder(b.location, place) else { continue }
            let full = ps.prefix(depth + 1).joined(separator: " › ")
            out[BinSearch.normalize(full), default: Child(place: full, name: ps[depth], count: 0)].count += 1
        }
        return out.values.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }
    /// ("Hangar › Shelf 2 › Left", "Hangar") → "Shelf 2 › Left".
    static func below(_ location: String, _ place: String) -> String {
        parts(location).dropFirst(parts(place).count).joined(separator: " › ")
    }
    /// Rename or move a place: every bin inside it follows.
    static func rename(_ location: String, from: String, to: String) -> String {
        guard isUnder(location, from) else { return location }
        return (parts(to) + parts(location).dropFirst(parts(from).count)).joined(separator: " › ")
    }
}

/// Trip checklist: each item in a trip bin is one thing to check off; a bin with no items is one thing itself.
enum TripList {
    static func keys(_ b: Bin) -> [String] {
        b.items.isEmpty ? [b.id.uuidString] : b.items.map { "\(b.id.uuidString)|\($0)" }
    }
    static func progress(_ bins: [Bin], checked: Set<String>) -> (done: Int, total: Int) {
        var done = 0, total = 0
        for b in bins where b.trip { for k in keys(b) { total += 1; if checked.contains(k) { done += 1 } } }
        return (done, total)
    }
}

/// Screens the app can open.
enum Route: Hashable {
    case bin(UUID)
    case place(String)
    case trip
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
