import Foundation

// The Job Jar! data and rules. These match job-jar/core.js in the web app, so a
// backup file from either version can be opened by the other.

let allDays = [0, 1, 2, 3, 4, 5, 6] // Sunday = 0
let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]
let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

let chorePics: [(String, String)] = [
    ("🛏️", "Make bed"), ("🪥", "Brush teeth"), ("🐶", "Feed the dog"), ("🐱", "Feed the cat"), ("🐟", "Feed the fish"),
    ("🧸", "Pick up toys"), ("🍽️", "Clear your plate"), ("🧺", "Clothes in hamper"), ("👕", "Get dressed"),
    ("👟", "Put shoes away"), ("🪴", "Water plants"), ("📚", "Read a book"), ("🍴", "Set the table"),
    ("🧼", "Wash hands"), ("🛁", "Take a bath"), ("🗑️", "Take out trash"), ("🧹", "Sweep"), ("🧽", "Wipe the table"),
    ("🎒", "Pack backpack"), ("✏️", "Homework"), ("🎹", "Practice music"), ("🧦", "Match socks"),
    ("🥣", "Help with breakfast"), ("🛒", "Help put away groceries"), ("🚗", "Clean up the car"), ("🌙", "Ready for bed"),
]
let rewardPics: [(String, String)] = [
    ("📖", "Extra story time"), ("🍦", "Ice cream trip"), ("🎬", "Pick the movie"), ("🛝", "Trip to the park"),
    ("🌙", "Stay up 15 minutes late"), ("🍕", "Pick dinner"), ("🎮", "Extra game time"), ("🧁", "Bake a treat together"),
    ("🎨", "Craft time"), ("🏊", "Swimming"), ("🎁", "Small toy"), ("🍿", "Movie night"), ("🚲", "Bike ride"),
    ("🧩", "Puzzle with a grown-up"), ("⛺", "Living room campout"), ("🦕", "Museum trip"), ("🍩", "Donut breakfast"), ("✈️", "Visit Granddad's airplane"),
]
let avatars = ["🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐲", "🐙", "🦖", "🐧", "🦋", "🐝", "🐬", "🦉", "🐢"]
let kidColors = ["#FF8A3D", "#3DA5FF", "#34C47C", "#B36BFF", "#FF5C8A", "#F2B800", "#20B8B0", "#8A6CFF"]

/// Money mode: every star becomes one coin of the family's chosen kind. d = size in millimeters, to draw coins to scale.
struct CoinKind {
    let key: String, cents: Int, name: String, plural: String, d: Double, face: String, edge: String
}
let coins: [CoinKind] = [
    CoinKind(key: "penny", cents: 1, name: "penny", plural: "pennies", d: 19.05, face: "#D9894A", edge: "#9C5A2A"),
    CoinKind(key: "nickel", cents: 5, name: "nickel", plural: "nickels", d: 21.21, face: "#C9CDD3", edge: "#8C9199"),
    CoinKind(key: "dime", cents: 10, name: "dime", plural: "dimes", d: 17.91, face: "#D5D9DE", edge: "#9298A1"),
    CoinKind(key: "quarter", cents: 25, name: "quarter", plural: "quarters", d: 24.26, face: "#CDD1D7", edge: "#8A9099"),
    CoinKind(key: "half", cents: 50, name: "half dollar", plural: "half dollars", d: 30.61, face: "#D2D6DB", edge: "#8E949C"),
    CoinKind(key: "dollar", cents: 100, name: "dollar coin", plural: "dollar coins", d: 26.49, face: "#E7C25A", edge: "#A9832A"),
]
func coinKind(_ key: String) -> CoinKind { coins.first { $0.key == key } ?? coins[1] }
let maxPay = 20 // most stars or coins one chore can earn

/// 25 -> "25¢", 135 -> "$1.35"
func money(_ cents: Int) -> String {
    let c = abs(cents)
    let t = c < 100 ? "\(c)¢" : String(format: "$%d.%02d", c / 100, c % 100)
    return (cents < 0 ? "−" : "") + t
}
/// For reading out loud: 135 -> "1 dollar and 35 cents"
func moneyWords(_ cents: Int) -> String {
    let c = abs(cents), dol = c / 100, ct = c % 100
    var parts: [String] = []
    if dol > 0 { parts.append("\(dol) " + (dol == 1 ? "dollar" : "dollars")) }
    if ct > 0 || dol == 0 { parts.append("\(ct) " + (ct == 1 ? "cent" : "cents")) }
    return parts.joined(separator: " and ")
}

/// A kid's own picture, saved as a small "data:image/...;base64," text so backups work in the web app too.
func validPhoto(_ p: String) -> Bool {
    guard p.count < 400_000, let comma = p.firstIndex(of: ",") else { return false }
    let head = p[..<comma]
    guard ["data:image/jpeg;base64", "data:image/png;base64", "data:image/webp;base64", "data:image/gif;base64"].contains(String(head)) else { return false }
    return p[p.index(after: comma)...].allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "+" || $0 == "/" || $0 == "=") }
}

let keepDays = 90
let keepLog = 500

func newId(_ prefix: String) -> String { prefix + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12).lowercased() }

func starWord(_ n: Int) -> String { "\(n) " + (abs(n) == 1 ? "star" : "stars") }
func validPin(_ p: String) -> Bool { p.count == 4 && p.allSatisfy { $0.isASCII && $0.isNumber } }

// MARK: - Days

private var cal: Calendar { Calendar.current }

/// Local calendar day as "YYYY-MM-DD".
func dayKey(_ d: Date) -> String {
    let c = cal.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}
func parseDay(_ key: String) -> Date {
    let p = key.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return Date() }
    return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) ?? Date()
}
func addDays(_ d: Date, _ n: Int) -> Date {
    let noon = cal.date(bySettingHour: 12, minute: 0, second: 0, of: d) ?? d
    return cal.date(byAdding: .day, value: n, to: noon) ?? d
}
/// 0 = Sunday ... 6 = Saturday
func weekday(_ d: Date) -> Int { cal.component(.weekday, from: d) - 1 }
func weekStart(_ d: Date) -> Date { addDays(d, -weekday(d)) }

private let isoFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
private let isoPlain = ISO8601DateFormatter()
func isoString(_ d: Date) -> String { isoFormatter.string(from: d) }
func isoDate(_ s: String) -> Date? { isoFormatter.date(from: s) ?? isoPlain.date(from: s) }

// MARK: - Models

struct Kid: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var avatar: String
    var color: String
    var stars: Int
    var photo: String = ""

    init(id: String = newId("k"), name: String, avatar: String, color: String, stars: Int = 0, photo: String = "") {
        self.id = id; self.name = name; self.avatar = avatar; self.color = color; self.stars = stars; self.photo = photo
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? newId("k")
        name = (try? c.decode(String.self, forKey: .name)) ?? "Kid"
        avatar = (try? c.decode(String.self, forKey: .avatar)) ?? avatars[0]
        color = (try? c.decode(String.self, forKey: .color)) ?? kidColors[0]
        let s = (try? c.decode(Double.self, forKey: .stars)) ?? 0
        stars = max(0, Int(s.rounded()))
        let ph = (try? c.decode(String.self, forKey: .photo)) ?? ""
        photo = validPhoto(ph) ? ph : ""
    }
}

struct Chore: Codable, Identifiable, Equatable {
    var id: String
    var pic: String
    var name: String
    var stars: Int
    var days: [Int]
    var kids: [String]

    init(id: String = newId("c"), pic: String, name: String, stars: Int = 1, days: [Int] = allDays, kids: [String] = []) {
        self.id = id; self.pic = pic; self.name = name; self.stars = stars; self.days = days; self.kids = kids
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? newId("c")
        pic = (try? c.decode(String.self, forKey: .pic)) ?? "⭐"
        name = (try? c.decode(String.self, forKey: .name)) ?? "Chore"
        stars = min(maxPay, max(1, (try? c.decode(Int.self, forKey: .stars)) ?? 1))
        let d = ((try? c.decode([Int].self, forKey: .days)) ?? []).filter { (0...6).contains($0) }
        days = d.isEmpty ? allDays : d
        kids = (try? c.decode([String].self, forKey: .kids)) ?? []
    }
}

struct Reward: Codable, Identifiable, Equatable {
    var id: String
    var pic: String
    var name: String
    var cost: Int

    init(id: String = newId("r"), pic: String, name: String, cost: Int) {
        self.id = id; self.pic = pic; self.name = name; self.cost = cost
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? newId("r")
        pic = (try? c.decode(String.self, forKey: .pic)) ?? "🎁"
        name = (try? c.decode(String.self, forKey: .name)) ?? "Reward"
        cost = max(1, (try? c.decode(Int.self, forKey: .cost)) ?? 1)
    }
}

struct LogEntry: Codable, Identifiable, Equatable {
    var id: String
    var t: String
    var kid: String
    var kind: String // chore, undo, reward, bonus, minus
    var text: String
    var pic: String
    var delta: Int
    var day: String?

    init(t: Date, kid: String, kind: String, text: String, pic: String, delta: Int, day: String? = nil) {
        id = newId("l"); self.t = isoString(t); self.kid = kid; self.kind = kind; self.text = text; self.pic = pic; self.delta = delta; self.day = day
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? newId("l")
        t = (try? c.decode(String.self, forKey: .t)) ?? isoString(Date())
        kid = (try? c.decode(String.self, forKey: .kid)) ?? ""
        kind = (try? c.decode(String.self, forKey: .kind)) ?? "chore"
        text = (try? c.decode(String.self, forKey: .text)) ?? ""
        pic = (try? c.decode(String.self, forKey: .pic)) ?? "⭐"
        delta = (try? c.decode(Int.self, forKey: .delta)) ?? 0
        day = try? c.decode(String.self, forKey: .day)
    }
}

struct Settings: Codable, Equatable {
    var pin = ""
    var needsApproval = false
    var sound = true
    var speak = true
    var money = false
    var coin = "nickel"

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pin = (try? c.decode(String.self, forKey: .pin)) ?? ""
        needsApproval = (try? c.decode(Bool.self, forKey: .needsApproval)) ?? false
        sound = (try? c.decode(Bool.self, forKey: .sound)) ?? true
        speak = (try? c.decode(Bool.self, forKey: .speak)) ?? true
        money = (try? c.decode(Bool.self, forKey: .money)) ?? false
        let k = (try? c.decode(String.self, forKey: .coin)) ?? "nickel"
        coin = coins.contains { $0.key == k } ? k : "nickel"
    }

    var coinKind: CoinKind { JobJar.coinKind(coin) }
    /// "3 stars" or, in money mode, "15¢"
    func amountText(_ n: Int) -> String { money ? JobJar.money(n * coinKind.cents) : starWord(n) }
    /// "⭐ 3" or "15¢"
    func amountShort(_ n: Int) -> String { money ? JobJar.money(n * coinKind.cents) : "⭐ \(n)" }
    /// For reading out loud
    func amountSpeech(_ n: Int) -> String { money ? moneyWords(n * coinKind.cents) : starWord(n) }
    /// "5 nickels"
    func coinCount(_ n: Int) -> String { "\(n) " + (n == 1 ? coinKind.name : coinKind.plural) }
}

enum ChoreStatus: String { case todo = "", waiting, done }
enum WeekCell: Equatable { case todo, waiting, done, off, future }

struct ChoreItem: Identifiable {
    var chore: Chore
    var status: ChoreStatus
    var id: String { chore.id }
}

struct WeekRow: Identifiable {
    var chore: Chore
    var cells: [WeekCell]
    var id: String { chore.id }
}

struct WeekChart {
    var days: [String]
    var rows: [WeekRow]
    var earned: [Int]
    var total: Int
}

struct WaitingItem: Identifiable {
    var day: String
    var kidId: String
    var chore: Chore
    var id: String { day + "|" + kidId + "|" + chore.id }
}

/// Everything the app saves. `done` is { "YYYY-MM-DD": { kidId: { choreId: "done" | "waiting" } } }.
struct AppData: Codable, Equatable {
    var version = 1
    var kids: [Kid] = []
    var chores: [Chore] = []
    var rewards: [Reward] = []
    var done: [String: [String: [String: String]]] = [:]
    var log: [LogEntry] = []
    var settings = Settings()
    var setupDone = false
    /// Rewards a kid asked for from their own device, waiting for a grown-up's yes or no.
    var requests: [RewardRequest] = []

    init() {}

    static func starter() -> AppData {
        var d = AppData()
        d.chores = [
            Chore(pic: "🛏️", name: "Make bed"), Chore(pic: "🪥", name: "Brush teeth"), Chore(pic: "🧸", name: "Pick up toys"),
            Chore(pic: "🍽️", name: "Clear your plate"), Chore(pic: "🧺", name: "Clothes in hamper"), Chore(pic: "🐶", name: "Feed the dog"),
        ]
        d.rewards = [
            Reward(pic: "📖", name: "Extra story time", cost: 5), Reward(pic: "🌙", name: "Stay up 15 minutes late", cost: 8),
            Reward(pic: "🎬", name: "Pick the movie", cost: 10), Reward(pic: "🍦", name: "Ice cream trip", cost: 15),
        ]
        return d
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let start = AppData.starter()
        version = (try? c.decode(Int.self, forKey: .version)) ?? 1
        kids = (try? c.decode([Kid].self, forKey: .kids)) ?? []
        chores = (try? c.decode([Chore].self, forKey: .chores)) ?? start.chores
        rewards = (try? c.decode([Reward].self, forKey: .rewards)) ?? start.rewards
        done = (try? c.decode([String: [String: [String: String]]].self, forKey: .done)) ?? [:]
        log = (try? c.decode([LogEntry].self, forKey: .log)) ?? []
        settings = (try? c.decode(Settings.self, forKey: .settings)) ?? Settings()
        setupDone = (try? c.decode(Bool.self, forKey: .setupDone)) ?? false
        requests = (try? c.decode([RewardRequest].self, forKey: .requests)) ?? []
    }

    // MARK: lookups
    func kid(_ id: String?) -> Kid? { kids.first { $0.id == id } }
    func chore(_ id: String) -> Chore? { chores.first { $0.id == id } }
    func reward(_ id: String) -> Reward? { rewards.first { $0.id == id } }
    private func kidIndex(_ id: String) -> Int? { kids.firstIndex { $0.id == id } }

    // MARK: rules
    static func isDue(_ chore: Chore, _ date: Date, _ kidId: String) -> Bool {
        if !chore.kids.isEmpty && !chore.kids.contains(kidId) { return false }
        return chore.days.contains(weekday(date))
    }

    func status(_ kidId: String, _ choreId: String, _ date: Date) -> ChoreStatus {
        ChoreStatus(rawValue: done[dayKey(date)]?[kidId]?[choreId] ?? "") ?? .todo
    }

    func choresFor(_ kidId: String, _ date: Date) -> [ChoreItem] {
        chores.filter { AppData.isDue($0, date, kidId) }.map { ChoreItem(chore: $0, status: status(kidId, $0.id, date)) }
    }

    func progress(_ kidId: String, _ date: Date) -> (finished: Int, total: Int, allDone: Bool) {
        let list = choresFor(kidId, date)
        let f = list.filter { $0.status != .todo }.count
        return (f, list.count, !list.isEmpty && f == list.count)
    }

    private mutating func setStatus(_ kidId: String, _ choreId: String, _ date: Date, _ st: ChoreStatus) {
        let k = dayKey(date)
        var day = done[k] ?? [:]
        var forKid = day[kidId] ?? [:]
        if st == .todo { forKid[choreId] = nil } else { forKid[choreId] = st.rawValue }
        day[kidId] = forKid
        done[k] = day
    }

    private mutating func addLog(_ e: LogEntry) {
        log.insert(e, at: 0)
        if log.count > keepLog { log.removeLast(log.count - keepLog) }
    }

    /// Kid taps "I did it!". Returns the stars given (0 if waiting for a grown-up or already done).
    @discardableResult
    mutating func markDone(_ kidId: String, _ choreId: String, _ date: Date, now: Date = Date()) -> Int {
        guard let ki = kidIndex(kidId), let c = chore(choreId), status(kidId, choreId, date) == .todo else { return 0 }
        if settings.needsApproval { setStatus(kidId, choreId, date, .waiting); return 0 }
        setStatus(kidId, choreId, date, .done)
        kids[ki].stars += c.stars
        addLog(LogEntry(t: now, kid: kidId, kind: "chore", text: c.name, pic: c.pic, delta: c.stars, day: dayKey(date)))
        return c.stars
    }

    /// "Not done yet": takes the check off and the stars back (never below zero).
    @discardableResult
    mutating func undo(_ kidId: String, _ choreId: String, _ date: Date, now: Date = Date()) -> Int {
        let st = status(kidId, choreId, date)
        guard let ki = kidIndex(kidId), st != .todo else { return 0 }
        setStatus(kidId, choreId, date, .todo)
        guard st == .done, let c = chore(choreId) else { return 0 }
        let back = min(kids[ki].stars, c.stars)
        kids[ki].stars -= back
        addLog(LogEntry(t: now, kid: kidId, kind: "undo", text: c.name + " (taken off)", pic: c.pic, delta: -back, day: dayKey(date)))
        return back
    }

    func waitingList() -> [WaitingItem] {
        var out: [WaitingItem] = []
        for day in done.keys.sorted(by: >) {
            for (kidId, map) in (done[day] ?? [:]).sorted(by: { $0.key < $1.key }) {
                for (choreId, st) in map.sorted(by: { $0.key < $1.key }) where st == "waiting" {
                    if let c = chore(choreId), kid(kidId) != nil { out.append(WaitingItem(day: day, kidId: kidId, chore: c)) }
                }
            }
        }
        return out
    }

    @discardableResult
    mutating func approve(_ kidId: String, _ choreId: String, _ day: String, now: Date = Date()) -> Int {
        let date = parseDay(day)
        guard let ki = kidIndex(kidId), let c = chore(choreId), status(kidId, choreId, date) == .waiting else { return 0 }
        setStatus(kidId, choreId, date, .done)
        kids[ki].stars += c.stars
        addLog(LogEntry(t: now, kid: kidId, kind: "chore", text: c.name, pic: c.pic, delta: c.stars, day: day))
        return c.stars
    }

    mutating func reject(_ kidId: String, _ choreId: String, _ day: String) {
        let date = parseDay(day)
        if status(kidId, choreId, date) == .waiting { setStatus(kidId, choreId, date, .todo) }
    }

    func canAfford(_ kidId: String, _ rewardId: String) -> Bool {
        guard let k = kid(kidId), let r = reward(rewardId) else { return false }
        return k.stars >= r.cost
    }

    @discardableResult
    mutating func redeem(_ kidId: String, _ rewardId: String, now: Date = Date()) -> Bool {
        guard canAfford(kidId, rewardId), let ki = kidIndex(kidId), let r = reward(rewardId) else { return false }
        kids[ki].stars -= r.cost
        addLog(LogEntry(t: now, kid: kidId, kind: "reward", text: r.name, pic: r.pic, delta: -r.cost))
        return true
    }

    /// Grown-up gives bonus stars (positive) or takes some away (negative). Returns the actual change.
    @discardableResult
    mutating func adjust(_ kidId: String, _ delta: Int, reason: String = "", now: Date = Date()) -> Int {
        guard let ki = kidIndex(kidId), delta != 0 else { return 0 }
        let change = delta < 0 ? -min(kids[ki].stars, -delta) : delta
        kids[ki].stars += change
        let text = reason.isEmpty ? (change > 0 ? "Bonus stars" : "Stars taken away") : reason
        addLog(LogEntry(t: now, kid: kidId, kind: change > 0 ? "bonus" : "minus", text: text, pic: change > 0 ? "🌟" : "➖", delta: change))
        return change
    }

    func weekChart(_ kidId: String, _ today: Date) -> WeekChart {
        let start = weekStart(today)
        let dates = allDays.map { addDays(start, $0) }
        let keys = dates.map(dayKey)
        let todayKey = dayKey(today)
        let rows: [WeekRow] = chores.filter { $0.kids.isEmpty || $0.kids.contains(kidId) }.map { c in
            WeekRow(chore: c, cells: dates.enumerated().map { i, d -> WeekCell in
                if !AppData.isDue(c, d, kidId) { return .off }
                switch status(kidId, c.id, d) {
                case .done: return .done
                case .waiting: return .waiting
                case .todo: return keys[i] > todayKey ? .future : .todo
                }
            })
        }
        let earned = keys.map { k in
            log.filter { $0.kid == kidId && ($0.kind == "chore" || $0.kind == "undo") && $0.day == k }.reduce(0) { $0 + $1.delta }
        }
        return WeekChart(days: keys, rows: rows, earned: earned, total: earned.reduce(0, +))
    }

    /// Clears check-offs older than keepDays and data for kids that were removed.
    mutating func prune(_ today: Date) {
        let cutoff = dayKey(addDays(today, -keepDays))
        let ids = Set(kids.map(\.id))
        for k in done.keys {
            if k < cutoff { done[k] = nil; continue }
            done[k] = done[k]?.filter { ids.contains($0.key) }
        }
        for i in chores.indices { chores[i].kids = chores[i].kids.filter { ids.contains($0) } }
        let rewardIds = Set(rewards.map(\.id))
        requests.removeAll { !ids.contains($0.kid) || !rewardIds.contains($0.reward) }
    }

    mutating func removeKid(_ kidId: String) {
        kids.removeAll { $0.id == kidId }
        log.removeAll { $0.kid == kidId }
        prune(Date())
    }
}
