import SwiftUI

@main
struct JobJarApp: App {
    @StateObject private var store: JarStore
    @StateObject private var sync: SyncHub
    @StateObject private var ui = UIState()

    init() {
        let args = ProcessInfo.processInfo.arguments
        let s: JarStore
        let hub: SyncHub
        if args.contains("-demoData") || args.contains("-demoKid") {
            // Sample family, not saved, used by the automated screenshot test. No networking.
            s = JarStore(file: nil)
            DemoData.seed(s)
            hub = SyncHub(store: s, file: nil, dry: true)
            if args.contains("-demoKid") { DemoData.makeKidDevice(s, hub) } else { DemoData.addLinkedDevice(s, hub) }
        } else if args.contains("-freshStart") {
            s = JarStore(file: nil)
            hub = SyncHub(store: s, file: nil, dry: true)
        } else {
            s = JarStore(file: JarStore.documentsFile())
            hub = SyncHub(store: s, file: SyncHub.documentsFile(), dry: false)
        }
        _store = StateObject(wrappedValue: s)
        _sync = StateObject(wrappedValue: hub)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(sync)
                .environmentObject(ui)
                .tint(Theme.purple)
        }
    }
}

enum Screen: Equatable { case home, kid(String), grownUps }

struct Party: Identifiable {
    let id = UUID()
    var pic: String
    var title: String
    var sub: String
    var big: Bool
}

/// A request for a grown-up: check the PIN, set a new PIN, or (with no PIN) just confirm.
struct Gate: Identifiable {
    enum Mode { case check, set, confirm }
    let id = UUID()
    var mode: Mode
    var title: String
    var done: (String) -> Void
}

/// Which screen is showing, plus the celebration and grown-up check that can pop up over any screen.
final class UIState: ObservableObject {
    @Published var screen: Screen = .home
    @Published var party: Party?
    @Published var gate: Gate?
    private var partyTask: DispatchWorkItem?

    func celebrate(_ pic: String, _ title: String, _ sub: String = "", big: Bool = false) {
        let p = Party(pic: pic, title: title, sub: sub, big: big)
        party = p
        partyTask?.cancel()
        let task = DispatchWorkItem { [weak self] in if self?.party?.id == p.id { self?.party = nil } }
        partyTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + (big ? 2.6 : 1.5), execute: task)
    }

    /// Runs `then` after a grown-up enters the PIN, or after a simple confirm if there's no PIN.
    func askGrownUp(_ store: JarStore, _ title: String, then: @escaping () -> Void) {
        gate = Gate(mode: validPin(store.data.settings.pin) ? .check : .confirm, title: title) { _ in then() }
    }
}

struct RootView: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @EnvironmentObject var ui: UIState
    @Environment(\.scenePhase) private var phase
    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            Group {
                if sync.isKid {
                    kidDevice
                } else if !store.data.setupDone {
                    WelcomeView()
                } else {
                    switch ui.screen {
                    case .home: HomeView()
                    case .kid(let id):
                        if store.data.kid(id) != nil { KidView(kidId: id) } else { HomeView() }
                    case .grownUps: GrownUpView()
                    }
                }
            }
            if let p = ui.party {
                CelebrationView(party: p)
                    .onTapGesture { ui.party = nil }
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .fontDesign(.rounded)
        .sheet(item: $ui.gate) { g in GateView(gate: g).environmentObject(store) }
        .onReceive(tick) { _ in store.refreshDay() }
        .onChange(of: phase) { p in
            if p == .active { store.refreshDay(); sync.appActive() }
            if p == .background { sync.appInactive() }
        }
        .onChange(of: store.data) { _ in sync.dataChanged() }
        .onAppear {
            sync.onReward = { r in
                store.fanfare()
                ui.celebrate(r.pic, r.name + "!", "A grown-up said yes!", big: true)
                store.say("Hooray! \(r.name)!")
            }
            sync.onStars = { store.ding() }
            sync.appActive()
        }
    }

    /// A kid's device shows only that kid's chart (or a short list if siblings share the device).
    @ViewBuilder private var kidDevice: some View {
        let kids = store.data.kids
        if !sync.config.isLinkedKid || kids.isEmpty {
            KidLinkView(asSheet: false)
        } else if kids.count == 1 {
            KidView(kidId: kids[0].id)
        } else if case .kid(let id) = ui.screen, store.data.kid(id) != nil {
            KidView(kidId: id)
        } else {
            HomeView()
        }
    }
}

struct WelcomeView: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @EnvironmentObject var ui: UIState

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image("Logo").resizable().frame(width: 140, height: 140).clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                    .shadow(color: .black.opacity(0.12), radius: 12, y: 6)
                    .padding(.top, 40)
                Text("The Job Jar!").font(.system(size: 38, weight: .black, design: .rounded))
                Text("A picture chore chart for little helpers. Kids tap a picture when a chore is done and earn a star. Stars fill their jar, and a full jar buys a reward your family picks.")
                    .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Text("First, a grown-up picks a 4-number PIN. It keeps kids out of the settings and lets you OK rewards.")
                    .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button {
                    ui.gate = Gate(mode: .set, title: "Pick a 4-number grown-up PIN") { pin in
                        store.data.settings.pin = pin
                        finish()
                    }
                } label: {
                    Text("Let's start").font(.title2.bold()).frame(maxWidth: 360).padding(.vertical, 16)
                        .background(Theme.purple, in: RoundedRectangle(cornerRadius: 18)).foregroundStyle(.white)
                }
                .accessibilityIdentifier("start")
                Button("Skip the PIN for now") { finish() }.font(.headline)
                Divider().padding(.vertical, 8)
                Text("Setting up a kid's own iPad or iPhone? Link it to the grown-up's device and it will show only that kid's chart.")
                    .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button {
                    sync.config.role = "kid"
                } label: {
                    Text("🧒 This is a kid's device").font(.title3.bold()).frame(maxWidth: 360).padding(.vertical, 14)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18)).foregroundStyle(.primary)
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.purple, lineWidth: 3))
                }
                .accessibilityIdentifier("kidDevice")
            }
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
    }

    private func finish() {
        sync.config.role = "parent"
        store.data.setupDone = true
        ui.screen = .grownUps
        GrownUpView.openAddKidOnAppear = true
    }
}
