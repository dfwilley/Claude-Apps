import SwiftUI
import MultipeerConnectivity
import UIKit

/// A message between a grown-up's device and a kid's device.
struct Wire: Codable {
    var t: String            // pair, paired, hello, ops, state, denied
    var code: String?
    var deviceId: String?
    var deviceName: String?
    var token: String?
    var familyId: String?
    var parentName: String?
    var ops: [SyncOp]?
    var acked: [String]?
    var data: AppData?
    var why: String?

    init(_ t: String) { self.t = t }
}

/// The code a grown-up's device shows while a kid's device is being linked.
struct PairOffer: Equatable {
    var kidId: String
    var code: String
    var expires: Date
    var wrongTries = 0
    var linked = false
}

enum KidLink: Equatable { case searching, found, sending, wrongCode, linked, unlinked }

/// Keeps a grown-up's device and kid devices in step when they are on the same Wi-Fi
/// (or close together) with the app open. Nothing goes through the internet.
final class SyncHub: NSObject, ObservableObject {
    @Published var config: SyncConfig { didSet { if config != oldValue { save() } } }
    @Published var offer: PairOffer?                 // grown-up's device
    @Published var onlineDevices: Set<String> = []   // grown-up's device: linked kid devices connected right now
    @Published var kidLink: KidLink = .searching     // kid's device
    @Published var parentOnline = false              // kid's device
    @Published var wantsToLink = false               // kid's device: the link screen is showing

    let store: JarStore
    var onReward: ((Reward) -> Void)?   // kid's device: a grown-up said yes to a reward
    var onStars: (() -> Void)?          // kid's device: stars arrived from the grown-up's device

    private let file: URL?
    private let dry: Bool               // true in automated tests: no networking
    private let serviceType = "jobjar"
    private var peer: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var authed: [MCPeerID: String] = [:]   // grown-up's device: peer -> linked device id
    private var invited: Set<MCPeerID> = []
    private var active = false
    private var pushTask: DispatchWorkItem?
    private var lastPushed: [String: AppData] = [:]

    init(store: JarStore, file: URL?, dry: Bool) {
        self.store = store
        self.file = file
        self.dry = dry
        if let file, let raw = try? Data(contentsOf: file), let c = try? JSONDecoder().decode(SyncConfig.self, from: raw) {
            config = c
        } else {
            config = SyncConfig()
        }
        super.init()
        if config.isLinkedKid { kidLink = .linked }
    }

    static func documentsFile() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("jobjar-links.json")
    }

    private func save() {
        guard let file else { return }
        try? JSONEncoder().encode(config).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    var isKid: Bool { config.isKid }
    private var isParent: Bool { !config.isKid }

    // MARK: starting and stopping

    /// Call when the app comes to the front.
    func appActive() { active = true; restart() }
    /// Call when the app leaves the screen.
    func appInactive() { active = false; stop() }

    /// Starts or stops networking to match what this device needs right now.
    func restart() {
        stop()
        guard active, !dry else { return }
        if isParent {
            // Only look for kid devices if there are some, or one is being linked right now.
            guard !config.devices.isEmpty || offer != nil else { return }
            let s = makeSession()
            let a = MCNearbyServiceAdvertiser(peer: s.myPeerID, discoveryInfo: ["role": "parent", "fam": config.familyId], serviceType: serviceType)
            a.delegate = self
            a.startAdvertisingPeer()
            advertiser = a
        } else {
            guard config.isLinkedKid || wantsToLink else { return }
            let s = makeSession()
            let b = MCNearbyServiceBrowser(peer: s.myPeerID, serviceType: serviceType)
            b.delegate = self
            b.startBrowsingForPeers()
            browser = b
        }
    }

    private func stop() {
        advertiser?.stopAdvertisingPeer(); advertiser?.delegate = nil; advertiser = nil
        browser?.stopBrowsingForPeers(); browser?.delegate = nil; browser = nil
        session?.delegate = nil; session?.disconnect(); session = nil
        authed = [:]; invited = []; lastPushed = [:]
        onlineDevices = []
        parentOnline = false
        if kidLink == .found || kidLink == .sending { kidLink = .searching }
    }

    private func makeSession() -> MCSession {
        var name = UIDevice.current.name.trimmingCharacters(in: .whitespaces)
        if name.isEmpty { name = "Device" }
        let p = MCPeerID(displayName: String(name.prefix(30)))
        let s = MCSession(peer: p, securityIdentity: nil, encryptionPreference: .required)
        s.delegate = self
        peer = p
        session = s
        return s
    }

    private func send(_ w: Wire, to peers: [MCPeerID]) {
        guard let session, !peers.isEmpty, let raw = try? JSONEncoder().encode(w) else { return }
        let live = peers.filter { session.connectedPeers.contains($0) }
        guard !live.isEmpty else { return }
        try? session.send(raw, toPeers: live, with: .reliable)
    }

    // MARK: grown-up's device

    /// Shows a 6-number code for linking a kid's device to this kid. Good for 10 minutes.
    func startOffer(kidId: String) {
        if config.familyId.isEmpty { config.familyId = newId("f") }
        if config.role.isEmpty { config.role = "parent" }
        offer = PairOffer(kidId: kidId, code: newPairCode(), expires: Date().addingTimeInterval(600))
        restart()
    }

    func endOffer() {
        let wasLinked = offer?.linked ?? false
        offer = nil
        if !wasLinked && config.devices.isEmpty { restart() }
    }

    func unlink(_ deviceId: String) {
        let peers = authed.filter { $0.value == deviceId }.map(\.key)
        var w = Wire("denied"); w.why = "unlinked"
        send(w, to: peers)
        for p in peers { authed[p] = nil }
        onlineDevices.remove(deviceId)
        config.devices.removeAll { $0.id == deviceId }
        if config.devices.isEmpty && offer == nil { restart() }
    }

    /// Call whenever the jar changes on the grown-up's device, so kid devices get the news.
    func dataChanged() {
        guard isParent, !authed.isEmpty else { return }
        pushTask?.cancel()
        let task = DispatchWorkItem { [weak self] in self?.pushAll() }
        pushTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: task)
    }

    private func pushAll() {
        // A kid who was removed from the jar comes off their device too.
        let kidIds = Set(store.data.kids.map(\.id))
        for i in config.devices.indices where !config.devices[i].kidIds.allSatisfy({ kidIds.contains($0) }) {
            config.devices[i].kidIds.removeAll { !kidIds.contains($0) }
        }
        for (p, id) in authed { pushState(to: p, deviceId: id, acked: nil) }
    }

    private func pushState(to p: MCPeerID, deviceId: String, acked: [String]?) {
        guard let d = config.devices.first(where: { $0.id == deviceId }) else { return }
        let slice = store.data.slice(for: d.kidIds)
        if acked == nil, lastPushed[deviceId] == slice { return }
        lastPushed[deviceId] = slice
        var w = Wire("state"); w.data = slice; w.acked = acked
        send(w, to: [p])
    }

    private func parentGot(_ w: Wire, from p: MCPeerID) {
        switch w.t {
        case "pair":
            guard var o = offer, !o.linked, o.expires > Date(), let devId = w.deviceId, store.data.kid(o.kidId) != nil else {
                var no = Wire("denied"); no.why = "code"; send(no, to: [p]); return
            }
            guard w.code == o.code else {
                o.wrongTries += 1
                offer = o.wrongTries >= 5 ? nil : o   // too many wrong guesses: the code stops working
                var no = Wire("denied"); no.why = "code"; send(no, to: [p]); return
            }
            let d = config.link(deviceId: devId, name: w.deviceName ?? "Device", kidId: o.kidId)
            o.linked = true
            offer = o
            authed[p] = d.id
            onlineDevices.insert(d.id)
            var yes = Wire("paired")
            yes.familyId = config.familyId; yes.token = d.token; yes.parentName = UIDevice.current.name
            yes.data = store.data.slice(for: d.kidIds)
            lastPushed[d.id] = yes.data
            send(yes, to: [p])
        case "hello":
            guard let d = config.device(w.deviceId, token: w.token) else {
                var no = Wire("denied"); no.why = "unlinked"; send(no, to: [p]); return
            }
            authed[p] = d.id
            onlineDevices.insert(d.id)
            pushState(to: p, deviceId: d.id, acked: [])
        case "ops":
            guard let id = authed[p], let d = config.devices.first(where: { $0.id == id }) else { return }
            var data = store.data
            let acked = config.receive(w.ops ?? [], from: d, into: &data)
            store.data = data
            pushState(to: p, deviceId: id, acked: acked)
        default:
            break
        }
    }

    // MARK: kid's device

    /// Does something the kid tapped: right away on this device, and queued for the grown-up's device.
    /// On a grown-up's device it just does it. Returns stars earned.
    @discardableResult
    func perform(_ op: SyncOp) -> Int {
        let got = store.data.apply(op)
        if isKid {
            config.pending.append(op)
            sendPending()
        }
        return got
    }

    private func sendPending() {
        guard isKid, parentOnline, !config.pending.isEmpty, let session else { return }
        var w = Wire("ops"); w.ops = config.pending
        send(w, to: session.connectedPeers)
    }

    /// The link screen is showing (or went away): look for a grown-up's device.
    func setWantsToLink(_ on: Bool) {
        guard wantsToLink != on else { return }
        wantsToLink = on
        if config.isLinkedKid {
            // Already linked (adding another kid): the connection to the grown-up's device stays as it is.
            kidLink = on ? (parentOnline ? .found : .searching) : .linked
            return
        }
        if on && kidLink != .unlinked { kidLink = .searching }
        restart()
    }

    /// Kid's device: sends the 6 numbers to the grown-up's device nearby.
    func sendCode(_ code: String) {
        guard let session, !session.connectedPeers.isEmpty else { kidLink = .searching; return }
        kidLink = .sending
        var w = Wire("pair"); w.code = code; w.deviceId = config.deviceId; w.deviceName = UIDevice.current.name
        send(w, to: session.connectedPeers)
    }

    /// Takes this device back to the very first screen. The grown-up's device keeps everything.
    func forgetThisDevice() {
        stop()
        var fresh = SyncConfig()
        fresh.deviceId = config.deviceId
        config = fresh
        kidLink = .searching
        wantsToLink = false
        store.data = AppData.starter()
    }

    private func kidGot(_ w: Wire, from p: MCPeerID) {
        switch w.t {
        case "paired":
            guard let token = w.token, let fam = w.familyId, let slice = w.data else { return }
            config.role = "kid"
            config.token = token
            config.familyId = fam
            config.parentName = w.parentName ?? ""
            config.pending = []
            store.data = slice
            parentOnline = true
            kidLink = .linked
            wantsToLink = false
        case "state":
            guard config.isLinkedKid, let slice = w.data else { return }
            let before = store.data
            let merged = config.merge(slice: slice, acked: w.acked ?? [])
            store.data = merged
            announce(before: before, after: merged)
        case "denied":
            if w.why == "unlinked" {
                config.token = ""
                config.pending = []
                parentOnline = false
                kidLink = .unlinked
            } else if wantsToLink {
                kidLink = .wrongCode
            }
        default:
            break
        }
    }

    /// Cheers on the kid's device when a grown-up OKs a reward or a chore from their own device.
    private func announce(before: AppData, after: AppData) {
        let old = Set(before.log.map(\.id))
        let fresh = after.log.filter { !old.contains($0.id) }
        if let got = fresh.first(where: { $0.kind == "reward" }), let r = after.rewards.first(where: { $0.name == got.text }) {
            onReward?(r)
        } else if fresh.contains(where: { $0.delta > 0 }) {
            onStars?()
        }
    }

    private func peerChanged(_ p: MCPeerID, _ state: MCSessionState) {
        if isParent {
            if state == .notConnected, let id = authed[p] {
                authed[p] = nil
                if !authed.values.contains(id) { onlineDevices.remove(id) }
            }
            return
        }
        switch state {
        case .connected:
            if config.isLinkedKid {
                parentOnline = true
                var w = Wire("hello"); w.deviceId = config.deviceId; w.token = config.token
                send(w, to: [p])
                sendPending()
                if wantsToLink && kidLink == .searching { kidLink = .found }
            } else if kidLink == .searching {
                kidLink = .found
            }
        case .notConnected:
            invited.remove(p)
            if session?.connectedPeers.isEmpty ?? true {
                parentOnline = false
                if kidLink == .found || kidLink == .sending { kidLink = .searching }
                // Look again in a moment (the grown-up's device may have gone to sleep and come back).
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                    guard let self, self.active, self.isKid, self.session?.connectedPeers.isEmpty ?? true else { return }
                    self.restart()
                }
            }
        default:
            break
        }
    }
}

extension SyncHub: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async { [weak self] in
            guard let self, session === self.session else { return }
            self.peerChanged(peerID, state)
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let w = try? JSONDecoder().decode(Wire.self, from: data) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, session === self.session else { return }
            if self.isKid { self.kidGot(w, from: peerID) } else { self.parentGot(w, from: peerID) }
        }
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension SyncHub: MCNearbyServiceAdvertiserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        DispatchQueue.main.async { [weak self] in
            // Anyone nearby may connect, but nothing is shared until they prove they were linked (or type the code).
            guard let self, advertiser === self.advertiser, let s = self.session else { invitationHandler(false, nil); return }
            invitationHandler(true, s)
        }
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {}
}

extension SyncHub: MCNearbyServiceBrowserDelegate {
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async { [weak self] in
            guard let self, browser === self.browser, let s = self.session, info?["role"] == "parent" else { return }
            // Once linked, only talk to our own grown-up's device. While linking, try any nearby.
            if self.config.isLinkedKid, info?["fam"] != self.config.familyId { return }
            guard !self.invited.contains(peerID) else { return }
            self.invited.insert(peerID)
            browser.invitePeer(peerID, to: s, withContext: nil, timeout: 20)
        }
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async { [weak self] in self?.invited.remove(peerID) }
    }

    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {}
}
