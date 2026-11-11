import Foundation

// Rules for sharing a jar between a grown-up's device and a kid's device.
// The grown-up's device holds everything. A kid's device holds only a "slice":
// that kid's own chart. What the kid does is sent to the grown-up's device as
// small actions, and the grown-up's device sends back the up-to-date slice.

struct RewardRequest: Codable, Identifiable, Equatable {
    var id: String
    var kid: String
    var reward: String
    var t: String

    init(kid: String, reward: String, t: Date = Date()) {
        id = newId("q"); self.kid = kid; self.reward = reward; self.t = isoString(t)
    }
}

/// One thing a kid did on their own device.
struct SyncOp: Codable, Identifiable, Equatable {
    var id: String
    var kind: String // done, undo, ask, unask, picture
    var kid: String
    var chore: String?
    var reward: String?
    var day: String?
    var avatar: String?
    var photo: String?
    var t: String

    init(_ kind: String, kid: String, chore: String? = nil, reward: String? = nil, day: String? = nil,
         avatar: String? = nil, photo: String? = nil, t: Date = Date()) {
        id = newId("o"); self.kind = kind; self.kid = kid; self.chore = chore; self.reward = reward
        self.day = day; self.avatar = avatar; self.photo = photo; self.t = isoString(t)
    }
}

extension AppData {
    func asked(_ kidId: String, _ rewardId: String) -> Bool {
        requests.contains { $0.kid == kidId && $0.reward == rewardId }
    }

    /// Kid asks for a reward from their own device. Needs enough stars; one request per reward.
    @discardableResult
    mutating func ask(_ kidId: String, _ rewardId: String, now: Date = Date()) -> Bool {
        guard canAfford(kidId, rewardId), !asked(kidId, rewardId) else { return false }
        requests.append(RewardRequest(kid: kidId, reward: rewardId, t: now))
        return true
    }

    mutating func unask(_ kidId: String, _ rewardId: String) {
        requests.removeAll { $0.kid == kidId && $0.reward == rewardId }
    }

    /// Grown-up says yes (the stars come out of the jar) or no. Returns true if the reward was given.
    @discardableResult
    mutating func answer(_ requestId: String, yes: Bool, now: Date = Date()) -> Bool {
        guard let r = requests.first(where: { $0.id == requestId }) else { return false }
        requests.removeAll { $0.id == requestId }
        return yes ? redeem(r.kid, r.reward, now: now) : false
    }

    /// Carries out one kid action. Safe to run twice: a chore can't be earned twice, a reward can't be asked twice.
    /// Returns the stars earned (for a finished chore), otherwise 0.
    @discardableResult
    mutating func apply(_ op: SyncOp) -> Int {
        let when = isoDate(op.t) ?? Date()
        switch op.kind {
        case "done":
            guard let c = op.chore, let d = op.day else { return 0 }
            return markDone(op.kid, c, parseDay(d), now: when)
        case "undo":
            guard let c = op.chore, let d = op.day else { return 0 }
            undo(op.kid, c, parseDay(d), now: when)
        case "ask":
            if let r = op.reward { ask(op.kid, r, now: when) }
        case "unask":
            if let r = op.reward { unask(op.kid, r) }
        case "picture":
            guard let i = kids.firstIndex(where: { $0.id == op.kid }) else { return 0 }
            if let a = op.avatar, !a.isEmpty { kids[i].avatar = a }
            if let p = op.photo { kids[i].photo = (p.isEmpty || validPhoto(p)) ? p : kids[i].photo }
        default:
            break
        }
        return 0
    }

    /// The part of the jar that belongs on a kid's device: only these kids, their chores,
    /// their check-offs and history, plus the rewards. The grown-up PIN is left out.
    func slice(for kidIds: [String]) -> AppData {
        let ids = Set(kidIds)
        var d = AppData()
        d.version = version
        d.kids = kids.filter { ids.contains($0.id) }
        d.chores = chores.compactMap { c -> Chore? in
            if c.kids.isEmpty { return c }
            let mine = c.kids.filter { ids.contains($0) }
            if mine.isEmpty { return nil }
            var copy = c
            copy.kids = mine
            return copy
        }
        d.rewards = rewards
        for (day, byKid) in done {
            let mine = byKid.filter { ids.contains($0.key) && !$0.value.isEmpty }
            if !mine.isEmpty { d.done[day] = mine }
        }
        d.log = log.filter { ids.contains($0.kid) }
        d.requests = requests.filter { ids.contains($0.kid) }
        d.settings = settings
        d.settings.pin = ""
        d.setupDone = true
        return d
    }
}

// MARK: - What each device remembers about its links

struct LinkedDevice: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var token: String
    var kidIds: [String]
}

struct SyncConfig: Codable, Equatable {
    var role = ""            // "" = not chosen yet (or set up before linking existed), "parent", "kid"
    var deviceId = newId("d")
    var familyId = ""        // grown-up's device: its own family; kid's device: the family it is linked to
    var devices: [LinkedDevice] = []   // grown-up's device: the kid devices linked to it
    var applied: [String] = []         // grown-up's device: recent kid actions already carried out
    var token = ""           // kid's device: proof that it was linked
    var parentName = ""      // kid's device
    var pending: [SyncOp] = []         // kid's device: actions not yet received by the grown-up's device

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        role = (try? c.decode(String.self, forKey: .role)) ?? ""
        deviceId = (try? c.decode(String.self, forKey: .deviceId)) ?? newId("d")
        familyId = (try? c.decode(String.self, forKey: .familyId)) ?? ""
        devices = (try? c.decode([LinkedDevice].self, forKey: .devices)) ?? []
        applied = (try? c.decode([String].self, forKey: .applied)) ?? []
        token = (try? c.decode(String.self, forKey: .token)) ?? ""
        parentName = (try? c.decode(String.self, forKey: .parentName)) ?? ""
        pending = (try? c.decode([SyncOp].self, forKey: .pending)) ?? []
    }

    var isKid: Bool { role == "kid" }
    var isLinkedKid: Bool { isKid && !token.isEmpty }

    // Grown-up's device

    /// Checks a kid device's proof. Returns the device if it is still linked.
    func device(_ id: String?, token: String?) -> LinkedDevice? {
        guard let id, let token, !token.isEmpty else { return nil }
        return devices.first { $0.id == id && $0.token == token }
    }

    /// Links a kid device to a kid (or adds another kid to a device that is already linked).
    mutating func link(deviceId: String, name: String, kidId: String) -> LinkedDevice {
        if familyId.isEmpty { familyId = newId("f") }
        if let i = devices.firstIndex(where: { $0.id == deviceId }) {
            if !devices[i].kidIds.contains(kidId) { devices[i].kidIds.append(kidId) }
            devices[i].name = name
            return devices[i]
        }
        let d = LinkedDevice(id: deviceId, name: name, token: newId("t") + newId("t"), kidIds: [kidId])
        devices.append(d)
        return d
    }

    /// Carries out a kid device's actions on the grown-up's data, skipping repeats and
    /// anything about a kid that device isn't linked to. Returns the ids to confirm back.
    mutating func receive(_ ops: [SyncOp], from device: LinkedDevice, into data: inout AppData) -> [String] {
        for op in ops where device.kidIds.contains(op.kid) && !applied.contains(op.id) {
            data.apply(op)
            applied.append(op.id)
        }
        if applied.count > 400 { applied.removeFirst(applied.count - 400) }
        return ops.map(\.id)
    }

    // Kid's device

    /// Takes the fresh slice from the grown-up's device, then puts back anything the kid
    /// did that the grown-up's device hasn't confirmed yet.
    mutating func merge(slice: AppData, acked: [String]) -> AppData {
        pending.removeAll { acked.contains($0.id) }
        var d = slice
        for op in pending { d.apply(op) }
        return d
    }
}

func newPairCode() -> String { String(format: "%06d", Int.random(in: 0...999_999)) }
