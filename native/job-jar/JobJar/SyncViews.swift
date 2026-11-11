import SwiftUI

// Screens for linking a grown-up's device with kid devices.

// MARK: - Kid's device

/// The first screen on a kid's device: type the 6 numbers shown on the grown-up's device.
struct KidLinkView: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @Environment(\.dismiss) private var dismiss
    let asSheet: Bool   // true when adding another kid to a device that is already linked
    @State private var code = ""
    @State private var kidsBefore = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if asSheet {
                    HStack { Spacer(); Button("Cancel") { dismiss() }.font(.headline) }
                }
                Text("🔗").font(.system(size: 70)).padding(.top, asSheet ? 0 : 30)
                Text(asSheet ? "Add another kid" : "Link to a grown-up's device").font(.system(size: 30, weight: .black, design: .rounded)).multilineTextAlignment(.center)
                if sync.kidLink == .unlinked && !asSheet {
                    Text("This device isn't linked any more. A grown-up can link it again.")
                        .font(.headline).foregroundStyle(Theme.red).multilineTextAlignment(.center)
                }
                VStack(alignment: .leading, spacing: 10) {
                    step("1", "Put both devices on the same Wi-Fi and keep them close.")
                    step("2", "On the grown-up's device open The Job Jar!, then Grown-ups › Devices › Link a kid's device.")
                    step("3", "Type the 6 numbers it shows here.")
                }
                .padding(16).background(Theme.card, in: RoundedRectangle(cornerRadius: 18))

                TextField("6 numbers", text: $code)
                    .keyboardType(.numberPad)
                    .font(.system(size: 40, weight: .black, design: .rounded))
                    .multilineTextAlignment(.center)
                    .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    .frame(maxWidth: 300)
                    .onChange(of: code) { v in
                        let digits = String(v.filter { $0.isASCII && $0.isNumber }.prefix(6))
                        if digits != v { code = digits }
                    }
                    .accessibilityIdentifier("linkCode")

                HStack(spacing: 8) {
                    if sync.kidLink == .searching || sync.kidLink == .sending { ProgressView() }
                    Text(status).font(.headline).foregroundStyle(sync.kidLink == .wrongCode ? Theme.red : Color.secondary).multilineTextAlignment(.center)
                }
                .accessibilityIdentifier("linkStatus")

                Button {
                    sync.sendCode(code)
                } label: {
                    Text("Link").font(.title2.bold()).foregroundStyle(.white).frame(maxWidth: 300).padding(.vertical, 16)
                        .background(canSend ? Theme.purple : Color.gray.opacity(0.5), in: RoundedRectangle(cornerRadius: 18))
                }
                .disabled(!canSend)
                .accessibilityIdentifier("linkButton")

                if !asSheet {
                    Button("Back") { sync.forgetThisDevice() }.font(.headline).padding(.top, 6)
                }
            }
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.bg)
        .fontDesign(.rounded)
        .onAppear { kidsBefore = store.data.kids.count; sync.setWantsToLink(true) }
        .onDisappear { sync.setWantsToLink(false) }
        .onChange(of: sync.kidLink) { s in
            if asSheet && s == .linked { dismiss() }
        }
    }

    private var canSend: Bool { code.count == 6 && (sync.kidLink == .found || sync.kidLink == .wrongCode) }

    private var status: String {
        switch sync.kidLink {
        case .searching, .unlinked: return "Looking for a grown-up's device nearby…"
        case .found: return "Found a grown-up's device. Type the numbers and tap Link."
        case .sending: return "Linking…"
        case .wrongCode: return "Those numbers didn't match. Check the grown-up's device and try again."
        case .linked: return "Linked!"
        }
    }

    private func step(_ n: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(n).font(.headline).foregroundStyle(.white).frame(width: 28, height: 28).background(Theme.purple, in: Circle())
            Text(text).font(.body)
        }
    }
}

/// The small gear on a kid's device. A dot shows whether the grown-up's device is in reach.
struct KidDeviceButton: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @State private var open = false

    var body: some View {
        Button { open = true } label: {
            Image(systemName: "gearshape.fill").font(.title3).foregroundStyle(.secondary)
                .frame(width: 48, height: 48).background(Theme.card, in: Circle())
                .overlay(alignment: .topTrailing) {
                    Circle().fill(sync.parentOnline ? Theme.green : Color.gray).frame(width: 14, height: 14)
                        .overlay(Circle().stroke(Theme.bg, lineWidth: 2))
                }
        }
        .accessibilityLabel(sync.parentOnline ? "Device settings. Connected to the grown-up's device" : "Device settings. Not connected right now")
        .accessibilityIdentifier("kidDeviceMenu")
        .sheet(isPresented: $open) { KidDeviceMenu().environmentObject(store).environmentObject(sync) }
    }
}

/// Grown-up-only menu on a kid's device (behind a sum a young child can't do).
struct KidDeviceMenu: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @Environment(\.dismiss) private var dismiss
    @State private var a = 12 + Int.random(in: 0...6)
    @State private var b = 6 + Int.random(in: 0...3)
    @State private var answer = ""
    @State private var wrong = false
    @State private var unlocked = false
    @State private var adding = false
    @State private var confirmUnlink = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(sync.parentOnline ? "Connected to the grown-up's device" : "Not connected right now",
                          systemImage: sync.parentOnline ? "checkmark.circle.fill" : "wifi.slash")
                        .foregroundStyle(sync.parentOnline ? Theme.green : Color.secondary)
                    if !sync.config.pending.isEmpty {
                        Text("\(sync.config.pending.count) \(sync.config.pending.count == 1 ? "thing" : "things") waiting to be sent").foregroundStyle(.secondary)
                    }
                } footer: {
                    Text("This device catches up with the grown-up's device when both are on the same Wi-Fi with The Job Jar! open. Until then, everything done here is kept and sent later.")
                }
                if !unlocked {
                    Section("Grown-ups only") {
                        Text("What is \(a) × \(b)?")
                        TextField("Answer", text: $answer).keyboardType(.numberPad).accessibilityIdentifier("quizAnswer")
                        if wrong { Text("That's not right.").foregroundStyle(Theme.red) }
                        Button("Next") {
                            if Int(answer.trimmingCharacters(in: .whitespaces)) == a * b { unlocked = true; wrong = false } else { wrong = true }
                        }
                    }
                } else {
                    Section {
                        Button { adding = true } label: { Label("Add another kid to this device", systemImage: "person.badge.plus") }
                        Button(role: .destructive) { confirmUnlink = true } label: { Label("Unlink this device", systemImage: "xmark.circle") }
                    } footer: {
                        Text("Unlinking clears the chart from this device. Nothing is lost on the grown-up's device.")
                    }
                }
            }
            .navigationTitle("This device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.bold() } }
            .sheet(isPresented: $adding) { KidLinkView(asSheet: true).environmentObject(store).environmentObject(sync) }
            .confirmationDialog("Unlink this device and clear its chart?", isPresented: $confirmUnlink, titleVisibility: .visible) {
                Button("Unlink", role: .destructive) { dismiss(); sync.forgetThisDevice() }
            }
        }
        .fontDesign(.rounded)
    }
}

// MARK: - Grown-up's device

/// Grown-ups › Devices: the kid devices linked to this one.
struct DevicesTab: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @State private var linking = false
    @State private var unlinkId: String?

    var body: some View {
        Section {
            if sync.config.devices.isEmpty {
                Text("No kid devices linked yet.").foregroundStyle(.secondary)
            }
            ForEach(sync.config.devices) { d in
                HStack(spacing: 12) {
                    Image(systemName: "ipad.and.iphone").font(.title2).foregroundStyle(Theme.purple)
                    VStack(alignment: .leading) {
                        Text(names(d)).font(.headline)
                        Text(sync.onlineDevices.contains(d.id) ? "Connected now" : "Not in reach right now")
                            .font(.subheadline).foregroundStyle(sync.onlineDevices.contains(d.id) ? Theme.green : Color.secondary)
                    }
                    Spacer()
                    Button("Unlink") { unlinkId = d.id }.buttonStyle(.bordered).tint(Theme.red)
                }
            }
            Button { linking = true } label: { Label("Link a kid's device", systemImage: "plus.circle.fill").bold() }
                .disabled(store.data.kids.isEmpty)
                .accessibilityIdentifier("linkDevice")
                .sheet(isPresented: $linking, onDismiss: { sync.endOffer() }) {
                    LinkDeviceSheet().environmentObject(store).environmentObject(sync)
                }
                .confirmationDialog("Unlink this device? Its chart is cleared the next time it connects. Stars and history stay here.", isPresented: Binding(get: { unlinkId != nil }, set: { if !$0 { unlinkId = nil } }), titleVisibility: .visible) {
                    Button("Unlink", role: .destructive) { if let id = unlinkId { sync.unlink(id) }; unlinkId = nil }
                }
        } header: { Text("Kid devices") } footer: {
            Text("A linked device shows only that kid's chart, with no grown-up settings. The two devices stay in step whenever they are on the same Wi-Fi with The Job Jar! open on both. Nothing goes over the internet. If one is out of reach, it catches up next time.")
        }
    }

    private func names(_ d: LinkedDevice) -> String {
        let n = d.kidIds.compactMap { store.data.kid($0)?.name }
        return n.isEmpty ? d.name : "\(n.joined(separator: " & "))'s \(d.name)"
    }
}

/// Pick a kid, then show the 6 numbers to type on the kid's device.
struct LinkDeviceSheet: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    if let o = sync.offer, let kid = store.data.kid(o.kidId) {
                        if o.linked {
                            Text("✅").font(.system(size: 80))
                            Text("\(kid.name)'s device is linked!").font(.title.bold()).multilineTextAlignment(.center)
                                .accessibilityIdentifier("linkedOK")
                            Text("It now shows only \(kid.name)'s chart and stays in step with this device.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                        } else {
                            KidAvatar(kid: kid, size: 80)
                            Text("On \(kid.name)'s device").font(.title2.bold())
                            Text("Open The Job Jar!, tap “This is a kid's device”, and type these numbers:")
                                .foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Text(spaced(o.code)).font(.system(size: 52, weight: .black, design: .rounded)).monospacedDigit()
                                .padding(.horizontal, 22).padding(.vertical, 12)
                                .background(Theme.goldSoft, in: RoundedRectangle(cornerRadius: 18))
                                .accessibilityLabel("Code " + o.code.map { String($0) }.joined(separator: " "))
                                .accessibilityIdentifier("pairCode")
                            HStack(spacing: 8) { ProgressView(); Text("Waiting for the kid's device…").foregroundStyle(.secondary) }
                            Text("Both devices need to be on the same Wi-Fi and close by. If iPhone asks to let The Job Jar! find devices on your local network, choose Allow.")
                                .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }
                    } else {
                        Text("Whose device is it?").font(.title2.bold()).padding(.top, 10)
                        ForEach(store.data.kids) { k in
                            Button { sync.startOffer(kidId: k.id) } label: {
                                HStack(spacing: 14) {
                                    KidAvatar(kid: k, size: 54)
                                    Text(k.name).font(.title2.bold()).foregroundStyle(Color(hex: k.color))
                                    Spacer()
                                    Image(systemName: "chevron.right").foregroundStyle(.secondary)
                                }
                                .padding(14).background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("linkKid-\(k.name)")
                        }
                        Text("If two kids share one iPad, link the first kid, then on that iPad tap the gear › Add another kid.")
                            .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                }
                .padding(24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .background(Theme.bg)
            .navigationTitle("Link a kid's device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.bold().accessibilityIdentifier("linkDone") } }
        }
        .fontDesign(.rounded)
    }

    private func spaced(_ code: String) -> String {
        let c = Array(code)
        guard c.count == 6 else { return code }
        return String(c[0..<3]) + " " + String(c[3..<6])
    }
}
