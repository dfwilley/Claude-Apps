import SwiftUI
import UniformTypeIdentifiers

enum GUTab: String, CaseIterable, Identifiable {
    case check = "✅ Check", kids = "👧 Kids", chores = "🧹 Chores", rewards = "🎁 Rewards", specials = "🎉 Specials", history = "📜 History", devices = "📱 Devices", settings = "⚙️ Settings"
    var id: String { rawValue }
}

struct KidDraftID: Identifiable { let id: String? }

struct GrownUpView: View {
    static var openAddKidOnAppear = false
    static var startOnCheck = false

    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState
    @State private var tab: GUTab = .kids
    @State private var editKid: KidDraftID?
    @State private var editChore: ChoreDraft?
    @State private var editReward: RewardDraft?
    @State private var editSpecial: SpecialDraft?
    @State private var mult: [String: Int] = [:]   // Check tab: how many times over to pay each waiting chore
    @State private var editMatch: MatchDraft?
    @State private var historyKid = ""
    @State private var showRestore = false
    @State private var shareURL: URL?
    @State private var confirmErase = false
    @State private var alertText: String?

    private var tabs: [GUTab] {
        let showCheck = store.data.settings.needsApproval || !store.data.waitingList().isEmpty || !store.data.requests.isEmpty || !store.data.doneList(store.today).isEmpty
        return GUTab.allCases.filter { $0 != .check || showCheck }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 118), spacing: 6)], spacing: 6) {
                    Group {
                        ForEach(tabs) { t in
                            Button { tab = t } label: {
                                HStack(spacing: 4) {
                                    Text(t.rawValue).font(.headline).lineLimit(1).minimumScaleFactor(0.8)
                                    if t == .check, store.data.waitingList().count + store.data.requests.count > 0 {
                                        Text("\(store.data.waitingList().count + store.data.requests.count)").font(.caption.bold()).foregroundStyle(.white)
                                            .padding(.horizontal, 7).padding(.vertical, 2).background(Theme.red, in: Capsule())
                                    }
                                }
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                .foregroundStyle(tab == t ? .white : .primary)
                                .frame(maxWidth: .infinity)
                                .background(tab == t ? Theme.purple : Theme.card, in: RoundedRectangle(cornerRadius: 14))
                            }
                            .accessibilityIdentifier("gu-\(t)")
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
                content
            }
            .background(Theme.bg)
            .navigationTitle("Grown-ups")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { ui.screen = .home }.bold().accessibilityIdentifier("guDone")
                }
            }
        }
        .onAppear {
            if GrownUpView.startOnCheck { tab = .check; GrownUpView.startOnCheck = false }
            if GrownUpView.openAddKidOnAppear {
                GrownUpView.openAddKidOnAppear = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { editKid = KidDraftID(id: nil) }
            }
        }
        .sheet(item: $editKid) { d in KidEditor(kidId: d.id).environmentObject(store) }
        .sheet(item: $editChore) { d in ChoreEditor(draft: d).environmentObject(store) }
        .sheet(item: $editReward) { d in RewardEditor(draft: d).environmentObject(store) }
        .sheet(item: $editSpecial) { d in SpecialEditor(draft: d).environmentObject(store) }
        .sheet(item: $editMatch) { d in MatchEditor(draft: d).environmentObject(store) }
        .sheet(item: Binding(get: { shareURL.map { ShareItem(url: $0) } }, set: { if $0 == nil { shareURL = nil } })) { item in
            ActivityView(items: [item.url])
        }
        .fileImporter(isPresented: $showRestore, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            do {
                try store.restore(from: Data(contentsOf: url))
                alertText = "Backup restored."
            } catch {
                alertText = "That file isn't a Job Jar backup."
            }
        }
        .alert(alertText ?? "", isPresented: Binding(get: { alertText != nil }, set: { if !$0 { alertText = nil } })) { Button("OK") {} }
        .confirmationDialog("Erase all kids, chores, rewards and stars on this device? This can't be undone.", isPresented: $confirmErase, titleVisibility: .visible) {
            Button("Erase everything", role: .destructive) {
                store.data = AppData.starter()
                ui.screen = .home
            }
        }
    }

    @ViewBuilder private var content: some View {
        let tab = tabs.contains(self.tab) ? self.tab : .kids
        List {
            switch tab {
            case .check: checkTab
            case .devices: DevicesTab()
            case .kids: kidsTab
            case .chores: choresTab
            case .rewards: rewardsTab
            case .specials: specialsTab
            case .history: historyTab
            case .settings: settingsTab
            }
        }
        .scrollContentBackground(.hidden)
        .frame(maxWidth: 860)
        .frame(maxWidth: .infinity)
    }

    // MARK: tabs

    @ViewBuilder private var checkTab: some View {
        let waiting = store.data.waitingList()
        if !store.data.requests.isEmpty {
            Section {
                ForEach(store.data.requests) { q in
                    if let k = store.data.kid(q.kid), let r = store.data.reward(q.reward) {
                        HStack(spacing: 12) {
                            Text(r.pic).font(.system(size: 34))
                            VStack(alignment: .leading) {
                                Text(r.name).font(.headline)
                                Text("\(k.name) is asking · costs \(store.data.settings.amountShort(r.cost))").font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button { store.data.answer(q.id, yes: false) } label: { Image(systemName: "xmark").font(.headline).padding(10) }
                                .buttonStyle(.bordered).accessibilityLabel("Not now")
                            Button {
                                if store.data.answer(q.id, yes: true) { store.fanfare() }
                            } label: { Text("Yes!").font(.headline) }
                                .buttonStyle(.borderedProminent).tint(Theme.gold).accessibilityIdentifier("yesReward")
                        }
                    }
                }
            } header: { Text("Rewards asked for") } footer: {
                Text("Sent from a kid's own device. “Yes!” takes the cost out of their jar and cheers on their device.")
            }
        }
        Section {
            if waiting.isEmpty {
                Text("👍 Nothing waiting to be checked.").foregroundStyle(.secondary)
            }
            ForEach(waiting) { w in
                let k = store.data.kid(w.kidId)
                let n = mult[w.id] ?? 1
                let pay = store.data.pay(w.kidId, w.chore, parseDay(w.day)) * n
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Text(w.chore.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(w.chore.name).font(.headline)
                            Text("\(k?.photo.isEmpty == false ? "" : k?.avatar ?? "") \(k?.name ?? "") · \(w.day == dayKey(store.today) ? "today" : longDay(w.day))").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 10) {
                        Button { store.data.reject(w.kidId, w.chore.id, w.day); mult[w.id] = nil } label: { Image(systemName: "xmark").font(.headline).padding(6) }
                            .buttonStyle(.bordered).accessibilityLabel("Not done")
                        Spacer()
                        // Pay it more than once: 3 goals scored, or a job done extra well
                        Button { mult[w.id] = max(1, n - 1) } label: { Image(systemName: "minus").font(.headline).padding(6) }
                            .buttonStyle(.bordered).disabled(n <= 1).accessibilityLabel("One fewer")
                        Text("×\(n)").font(.headline.monospacedDigit()).frame(minWidth: 34).accessibilityLabel("\(n) times")
                        Button { mult[w.id] = min(maxCount, n + 1) } label: { Image(systemName: "plus").font(.headline).padding(6) }
                            .buttonStyle(.bordered).disabled(n >= maxCount).accessibilityLabel("One more").accessibilityIdentifier("timesPlus")
                        Button { store.data.approve(w.kidId, w.chore.id, w.day, count: n); mult[w.id] = nil; store.ding() } label: { Text("✓ " + (store.data.settings.money || pay > 5 ? store.data.settings.amountShort(pay) : String(repeating: "⭐", count: pay))).font(.headline) }
                            .buttonStyle(.borderedProminent).tint(Theme.green).accessibilityIdentifier("approve")
                    }
                }
                .buttonStyle(.borderless)
            }
            if waiting.count > 1 {
                Button("✓ OK all of them") {
                    for w in store.data.waitingList() { store.data.approve(w.kidId, w.chore.id, w.day, count: mult[w.id] ?? 1) }
                    mult = [:]
                    store.fanfare()
                }.bold()
            }
        } footer: {
            Text("“Grown-up checks chores first” is \(store.data.settings.needsApproval ? "on" : "off") (Settings). When it's on, a chore turns yellow ⏳ until you OK it here, then the stars go in the jar. Use − and + to pay a chore more than once: ×3 for three goals scored, or ×2 for a job done extra well.")
        }
        let paid = store.data.doneList(store.today)
        if !paid.isEmpty {
            Section {
                ForEach(paid) { d in
                    let k = store.data.kid(d.kidId)
                    let one = store.data.pay(d.kidId, d.chore, store.today)
                    HStack(spacing: 12) {
                        Text(d.chore.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(d.chore.name + (d.count > 1 ? " ×\(d.count)" : "")).font(.headline)
                            Text("\(k?.photo.isEmpty == false ? "" : k?.avatar ?? "") \(k?.name ?? "") · \(store.data.settings.amountText(one * d.count))").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if d.count < maxCount {
                            Button {
                                if store.data.addMore(d.kidId, d.chore.id, dayKey(store.today)) > 0 { store.ding() }
                            } label: { Text("+ \(store.data.settings.amountShort(one)) more").font(.subheadline.bold()) }
                                .buttonStyle(.bordered).accessibilityIdentifier("payMore")
                        }
                    }
                }
            } header: { Text("Paid today") } footer: {
                Text("Did it again, or did it extra well? Tap “more” to pay the chore one more time.")
            }
        }
    }

    @ViewBuilder private var kidsTab: some View {
        Section {
            ForEach(store.data.kids) { k in
                Button { editKid = KidDraftID(id: k.id) } label: {
                    HStack(spacing: 12) {
                        KidAvatar(kid: k, size: 40)
                        VStack(alignment: .leading) {
                            Text(k.name).font(.headline).foregroundStyle(Color(hex: k.color))
                            Text("\(store.data.choresFor(k.id, store.today).count) chores today").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(store.data.settings.amountShort(k.stars)).bold().foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.primary)
            }
            Button { editKid = KidDraftID(id: nil) } label: { Label("Add a kid", systemImage: "plus.circle.fill").bold() }
                .accessibilityIdentifier("addKid")
        } footer: {
            Text("Each child gets their own picture, chores and star jar.")
        }
    }

    @ViewBuilder private var choresTab: some View {
        Section {
            ForEach(store.data.chores) { c in
                Button { editChore = ChoreDraft(c) } label: {
                    HStack(spacing: 12) {
                        Text(c.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(c.name).font(.headline)
                            Text("\(daysText(c.days)) · \(whoText(c.kids))" + (c.once ? " · once a day" : "") + (rangeText(c).isEmpty ? "" : " · " + rangeText(c))).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(store.data.settings.money ? store.data.settings.amountText(c.stars) : c.stars <= 5 ? String(repeating: "⭐", count: c.stars) : "⭐ \(c.stars)").font(store.data.settings.money ? .subheadline.bold() : .caption)
                    }
                }
                .foregroundStyle(.primary)
            }
            .onMove { from, to in store.data.chores.move(fromOffsets: from, toOffset: to) }
            Button { editChore = ChoreDraft(nil) } label: { Label("Add a chore", systemImage: "plus.circle.fill").bold() }
        } footer: {
            Text("Pick a picture for each chore so kids who can't read yet know what it is. They can also tap the speaker to hear it.")
        }
    }

    @ViewBuilder private var rewardsTab: some View {
        Section {
            ForEach(store.data.rewards) { r in
                Button { editReward = RewardDraft(r) } label: {
                    HStack(spacing: 12) {
                        Text(r.pic).font(.system(size: 34))
                        Text(r.name).font(.headline)
                        Spacer()
                        Text(store.data.settings.amountShort(r.cost)).bold().foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.primary)
            }
            Button { editReward = RewardDraft(nil) } label: { Label("Add a reward", systemImage: "plus.circle.fill").bold() }
        } footer: {
            Text(store.data.settings.money ? "When a kid has enough money, a “Get it!” button appears. A grown-up enters the PIN to OK it, and the price comes out of the jar." : "When a kid has enough stars, a “Get it!” button appears. A grown-up enters the PIN to OK it, and the stars come out of the jar.")
        }
    }

    @ViewBuilder private var specialsTab: some View {
        let todayKey = dayKey(store.today)
        let s = store.data.settings
        Section {
            ForEach(store.data.specials) { x in
                Button { editSpecial = SpecialDraft(x) } label: {
                    HStack(spacing: 12) {
                        Text(x.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(x.name).font(.headline)
                            Text("\(shortDay(x.date))\(x.yearly ? ", every year" : ", " + String(x.date.prefix(4))) · \(whoText(x.kids))").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(timesWord(x.times)).bold().foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.primary)
            }
            Button { editSpecial = SpecialDraft(nil) } label: { Label("Add a special day", systemImage: "plus.circle.fill").bold() }
                .accessibilityIdentifier("addSpecial")
        } header: { Text("Special days") } footer: {
            Text("On a special day, like a birthday, every chore pays double or triple.")
        }
        Section {
            ForEach(store.data.chores.filter { !$0.from.isEmpty || !$0.until.isEmpty }) { c in
                Button { editChore = ChoreDraft(c) } label: {
                    HStack(spacing: 12) {
                        Text(c.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(c.name).font(.headline)
                            Text(rangeText(c) + (!c.until.isEmpty && c.until < todayKey ? " · ended" : "") + " · " + whoText(c.kids)).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(s.amountShort(c.stars)).bold().foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.primary)
            }
            Button { editChore = ChoreDraft(nil, special: true) } label: { Label("Add a special chore", systemImage: "plus.circle.fill").bold() }
                .accessibilityIdentifier("addSpecialChore")
        } header: { Text("Special chores for a short time") } footer: {
            Text("A special chore shows on the kids' charts only between the days you pick, for example “Rake leaves” this weekend.")
        }
        Section {
            ForEach(store.data.matches) { m in
                Button { editMatch = MatchDraft(m) } label: {
                    HStack(spacing: 12) {
                        Text(m.pic).font(.system(size: 34))
                        VStack(alignment: .leading) {
                            Text(m.who).font(.headline)
                            Text(matchText(m.who, m.percent, s) + " · " + whoText(m.kids) + (m.until.isEmpty ? "" : (m.until < todayKey ? " · ended " : " · until ") + shortDay(m.until))).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(s.amountShort(m.totalGiven)) so far").bold().foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.primary)
            }
            Button { editMatch = MatchDraft(nil) } label: { Label("Add a match", systemImage: "plus.circle.fill").bold() }
                .accessibilityIdentifier("addMatch")
        } header: { Text("Matching from Grandma, Granddad or anyone") } footer: {
            Text("When someone offers to match what a kid earns, enter it here. The app adds their share each time a chore \(s.needsApproval ? "is OK'd" : "is done"), and keeps count of how much they have added.")
        }
    }

    @ViewBuilder private var historyTab: some View {
        Section {
            Picker("Who", selection: $historyKid) {
                Text("Everyone").tag("")
                ForEach(store.data.kids) { k in Text("\(k.avatar) \(k.name)").tag(k.id) }
            }
        }
        Section {
            let list = store.data.log.filter { historyKid.isEmpty || $0.kid == historyKid }.prefix(150)
            if list.isEmpty { Text("Nothing yet.").foregroundStyle(.secondary) }
            ForEach(Array(list)) { e in
                let k = store.data.kid(e.kid)
                HStack(spacing: 12) {
                    Text(e.pic).font(.system(size: 30))
                    VStack(alignment: .leading) {
                        Text(e.text).font(.headline)
                        Text("\(k.map { "\($0.avatar) \($0.name) · " } ?? "")\(when(e.t))").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(e.delta > 0 ? "+" : "")" + (store.data.settings.money ? money(e.delta * store.data.settings.coinKind.cents) : "\(e.delta) ⭐")).bold().foregroundStyle(e.delta > 0 ? Theme.green : e.delta < 0 ? Theme.red : .secondary)
                }
            }
        }
    }

    @ViewBuilder private var settingsTab: some View {
        MoneySettings()
        Section("Grown-up PIN") {
            Button {
                ui.gate = Gate(mode: .set, title: "Pick a new 4-number PIN") { pin in store.data.settings.pin = pin }
            } label: {
                Label(validPin(store.data.settings.pin) ? "Change the PIN" : "Set a PIN", systemImage: "lock.fill")
            }
            if validPin(store.data.settings.pin) {
                Button(role: .destructive) { store.data.settings.pin = "" } label: { Label("Remove the PIN", systemImage: "lock.open.fill") }
            }
        }
        Section {
            Toggle(isOn: $store.data.settings.needsApproval) {
                VStack(alignment: .leading) { Text("Grown-up checks chores first"); Text("Kids get their stars only after you OK each chore").font(.caption).foregroundStyle(.secondary) }
            }
            .accessibilityIdentifier("needsApproval")
            Toggle(isOn: $store.data.settings.sound) {
                VStack(alignment: .leading) { Text("Sounds"); Text("A happy chime when a star is earned").font(.caption).foregroundStyle(.secondary) }
            }
            Toggle(isOn: $store.data.settings.speak) {
                VStack(alignment: .leading) { Text("Read chores out loud"); Text("Says the chore name when a kid taps the speaker or finishes a chore").font(.caption).foregroundStyle(.secondary) }
            }
        } header: { Text("How it works") }
        .tint(Theme.green)
        Section {
            Button { shareURL = writeBackup() } label: { Label("Save a backup file", systemImage: "square.and.arrow.up") }
            Button { showRestore = true } label: { Label("Restore from a backup file", systemImage: "folder") }
        } header: { Text("Backup") } footer: { Text("Backups work with the web version of The Job Jar! too.") }
        Section {
            Button(role: .destructive) { confirmErase = true } label: { Label("Erase everything", systemImage: "trash") }
        } footer: {
            Text("Everything stays on this device. Nothing is sent anywhere. Version \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0").")
        }
    }

    // MARK: helpers

    private func writeBackup() -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("The Job Jar backup \(dayKey(Date())).json")
        do { try store.backupData().write(to: url); return url } catch { alertText = "Couldn't make the backup file."; return nil }
    }

    private func longDay(_ key: String) -> String {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMMM d"
        return f.string(from: parseDay(key))
    }

    private func when(_ iso: String) -> String {
        guard let d = isoDate(iso) else { return "" }
        let time = d.formatted(date: .omitted, time: .shortened)
        if dayKey(d) == dayKey(store.today) { return "Today \(time)" }
        if dayKey(d) == dayKey(addDays(store.today, -1)) { return "Yesterday \(time)" }
        let f = DateFormatter(); f.dateFormat = "EEE, MMMM d, yyyy"
        return f.string(from: d)
    }

    func whoText(_ ids: [String]) -> String {
        let names = ids.compactMap { store.data.kid($0)?.name }
        return names.isEmpty ? "Everyone" : names.joined(separator: ", ")
    }
}

func shortDay(_ key: String) -> String {
    let f = DateFormatter(); f.dateFormat = "MMM d"
    return f.string(from: parseDay(key))
}

func timesWord(_ n: Int) -> String { n == 2 ? "Double" : n == 3 ? "Triple" : "\(n)×" }

/// "Nov 5 – Nov 7" for a chore that only shows for a while.
func rangeText(_ c: Chore) -> String {
    if !c.from.isEmpty && !c.until.isEmpty { return c.from == c.until ? "only " + shortDay(c.from) : shortDay(c.from) + " – " + shortDay(c.until) }
    if !c.until.isEmpty { return "until " + shortDay(c.until) }
    if !c.from.isEmpty { return "from " + shortDay(c.from) }
    return ""
}

/// "For every 2 stars earned, Grandma adds 1"
func matchText(_ who: String, _ percent: Int, _ s: Settings) -> String {
    let unit = s.money ? s.coinKind.plural : "stars", one = s.money ? s.coinKind.name : "star"
    let pair: (Int, Int)
    switch percent {
    case 25: pair = (4, 1)
    case 50: pair = (2, 1)
    case 100: pair = (1, 1)
    case 200: pair = (1, 2)
    default: pair = (100, percent)
    }
    return "For every \(pair.0 == 1 ? one : "\(pair.0) \(unit)") earned, \(who) adds \(pair.1)"
}

let specialPics: [(String, String)] = [
    ("🎂", "Birthday"), ("🎉", "Special day"), ("🎄", "Christmas"), ("🎃", "Halloween"), ("🦃", "Thanksgiving"), ("🐣", "Easter"),
    ("🎆", "Fourth of July"), ("❄️", "Snow day"), ("🏖️", "Vacation day"), ("🏫", "Last day of school"), ("👵", "Grandparents' visit"), ("⭐", "Bonus day"),
]
let matchPics: [(String, String)] = [("👵", "Grandma"), ("👴", "Granddad"), ("🧓", "Nana"), ("👩", "Aunt"), ("👨", "Uncle"), ("💝", "A helper")]

func daysText(_ days: [Int]) -> String {
    let s = days.sorted()
    if s.count == 7 { return "Every day" }
    if s == [1, 2, 3, 4, 5] { return "School days" }
    if s == [0, 6] { return "Weekends" }
    return s.map { String(dayNames[$0].prefix(3)) }.joined(separator: ", ")
}

struct ShareItem: Identifiable { let url: URL; var id: String { url.path } }

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

// MARK: - Editors

struct PicGrid: View {
    let pics: [(String, String)]
    @Binding var selected: String
    var onPick: (String, String) -> Void = { _, _ in }
    /// Lets a grown-up type any emoji from the keyboard as the picture.
    var typeAny = true
    @State private var typed = ""

    /// A picture typed from the emoji keyboard isn't in the list: show it first so it can be seen as chosen.
    private var shown: [(String, String)] {
        selected.isEmpty || pics.contains { $0.0 == selected } ? pics : [(selected, "")] + pics
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 54), spacing: 6)], spacing: 6) {
            ForEach(shown, id: \.0) { p in
                Button { selected = p.0; onPick(p.0, p.1) } label: {
                    Text(p.0).font(.system(size: 32)).frame(maxWidth: .infinity, minHeight: 54)
                        .background(selected == p.0 ? Theme.purple.opacity(0.15) : Theme.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected == p.0 ? Theme.purple : .clear, lineWidth: 3))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(p.1.isEmpty ? p.0 : p.1)
                .accessibilityAddTraits(selected == p.0 ? .isSelected : [])
            }
        }
        .padding(.vertical, 4)
        if typeAny {
            TextField("Or type any emoji from your keyboard 😀", text: $typed)
                .autocorrectionDisabled()
                .accessibilityIdentifier("typeEmoji")
                .onChange(of: typed) { v in
                    if let e = pickEmoji(v) { selected = e; typed = "" }
                }
        }
    }
}

struct KidEditor: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    let kidId: String?
    @State private var name = ""
    @State private var avatar = avatars[0]
    @State private var color = kidColors[0]
    @State private var photo = ""
    @State private var confirmPayout = false
    @State private var give = 1
    @State private var why = ""
    @State private var confirmRemove = false

    var body: some View {
        let kid = store.data.kid(kidId)
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("First name", text: $name).font(.title3).textInputAutocapitalization(.words).accessibilityIdentifier("kidName")
                }
                Section("Picture (so they can find their own chart)") {
                    if let img = imageFromPhoto(photo) {
                        HStack(spacing: 14) {
                            Image(uiImage: img).resizable().scaledToFill().frame(width: 72, height: 72).clipShape(Circle())
                            Button("Remove photo") { photo = "" }.buttonStyle(.bordered)
                        }
                    }
                    PhotoImportButtons { s in photo = s }
                    PicGrid(pics: avatars.map { ($0, "") }, selected: Binding(get: { photo.isEmpty ? avatar : "" }, set: { avatar = $0; photo = "" }))
                }
                Section("Color") {
                    HStack(spacing: 10) {
                        ForEach(kidColors, id: \.self) { c in
                            Button { color = c } label: {
                                Circle().fill(Color(hex: c)).frame(width: 34, height: 34)
                                    .overlay(Circle().stroke(Color.primary, lineWidth: color == c ? 3 : 0).padding(-4))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Color \(c)")
                        }
                    }
                    .padding(.vertical, 6)
                }
                if let kid {
                    let s = store.data.settings
                    Section {
                        Stepper(s.money ? "\(s.coinCount(give)) (\(s.amountText(give)))" : starWord(give), value: $give, in: 1...50).font(.headline)
                        TextField("Why? (optional, e.g. Helped Grandma)", text: $why)
                        HStack {
                            Button("Give \(s.amountText(give))") { store.data.adjust(kid.id, give, reason: why.trimmingCharacters(in: .whitespaces)); store.ding(); why = "" }
                                .buttonStyle(.borderedProminent).tint(Theme.green)
                            Spacer()
                            Button("Take away \(s.money ? s.amountText(give) : "\(give)")") { store.data.adjust(kid.id, -give, reason: why.trimmingCharacters(in: .whitespaces)); why = "" }
                                .buttonStyle(.bordered)
                        }
                        if s.money && kid.stars > 0 {
                            Button("💵 I paid \(kid.name) \(s.amountText(kid.stars)) (empty the jar)") { confirmPayout = true }
                                .accessibilityIdentifier("payout")
                        }
                    } header: { Text(s.money ? "Money in the jar: \(s.amountText(kid.stars)) (\(s.coinCount(kid.stars)))" : "Stars in the jar: ⭐ \(kid.stars)") }
                    Section {
                        Button("Remove \(kid.name)", role: .destructive) { confirmRemove = true }
                    }
                }
            }
            .navigationTitle(kid == nil ? "Add a kid" : "Edit \(kid?.name ?? "")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.bold().disabled(name.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityIdentifier("saveKid")
                }
            }
            .confirmationDialog("Remove \(kid?.name ?? "") and their stars and history? This can't be undone.", isPresented: $confirmRemove, titleVisibility: .visible) {
                Button("Remove", role: .destructive) { if let id = kidId { store.data.removeKid(id) }; dismiss() }
            }
            .confirmationDialog("Mark \(store.data.settings.amountText(kid?.stars ?? 0)) as paid to \(kid?.name ?? "")? This empties the jar.", isPresented: $confirmPayout, titleVisibility: .visible) {
                Button("Yes, I paid it") { if let k = kid { store.data.adjust(k.id, -k.stars, reason: "Paid out") } }
            }
        }
        .onAppear {
            if let k = store.data.kid(kidId) { name = k.name; avatar = k.avatar; color = k.color; photo = k.photo }
            else {
                let used = Set(store.data.kids.map(\.avatar))
                avatar = avatars.first { !used.contains($0) } ?? avatars[0]
                color = kidColors[store.data.kids.count % kidColors.count]
            }
        }
    }

    private func save() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        if let id = kidId, let i = store.data.kids.firstIndex(where: { $0.id == id }) {
            store.data.kids[i].name = n; store.data.kids[i].avatar = avatar; store.data.kids[i].color = color; store.data.kids[i].photo = photo
        } else {
            store.data.kids.append(Kid(name: n, avatar: avatar, color: color, photo: photo))
        }
        dismiss()
    }
}

struct ChoreDraft: Identifiable {
    var id: String
    var isNew: Bool
    var chore: Chore
    init(_ c: Chore?, special: Bool = false) {
        isNew = c == nil
        chore = c ?? Chore(pic: special ? "🧹" : "🛏️", name: "")
        if c == nil && special { chore.from = dayKey(Date()); chore.until = dayKey(addDays(Date(), 6)) }
        id = chore.id
    }
}

struct ChoreEditor: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    @State var draft: ChoreDraft
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Picture") {
                    PicGrid(pics: chorePics, selected: $draft.chore.pic) { _, label in
                        let wasDefault = chorePics.contains { $0.1 == draft.chore.name }
                        if draft.chore.name.trimmingCharacters(in: .whitespaces).isEmpty || wasDefault { draft.chore.name = label }
                    }
                }
                Section("Name (read out loud when a kid taps the speaker)") {
                    TextField("Make bed", text: $draft.chore.name).font(.title3)
                }
                if store.data.settings.money {
                    Section("How much it pays (\(store.data.settings.coinKind.plural))") {
                        Stepper(store.data.settings.coinCount(draft.chore.stars), value: $draft.chore.stars, in: 1...maxPay).font(.title3.bold())
                            .accessibilityIdentifier("payStepper")
                        HStack { Spacer(); PayView(n: draft.chore.stars, scale: 1.3); Spacer() }.padding(.vertical, 6)
                    }
                } else {
                    Section("Stars it earns") {
                        Picker("Stars", selection: $draft.chore.stars) {
                            ForEach(Array(Set([1, 2, 3, 4, 5, draft.chore.stars])).sorted(), id: \.self) { n in Text(n <= 5 ? String(repeating: "⭐", count: n) : "⭐ \(n)").tag(n) }
                        }
                        .pickerStyle(.inline).labelsHidden()
                    }
                }
                Section {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 52), spacing: 6)], spacing: 6) {
                        ForEach(allDays, id: \.self) { d in
                            let on = draft.chore.days.contains(d)
                            Button {
                                if on { draft.chore.days.removeAll { $0 == d } } else { draft.chore.days.append(d); draft.chore.days.sort() }
                            } label: {
                                Text(String(dayNames[d].prefix(3))).bold().frame(maxWidth: .infinity, minHeight: 40)
                                    .foregroundStyle(on ? .white : .primary)
                                    .background(on ? Theme.purple : Theme.card, in: RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(dayNames[d]).accessibilityAddTraits(on ? .isSelected : [])
                        }
                    }
                    Button("Every day") { draft.chore.days = allDays }
                } header: { Text("Which days") } footer: { Text(daysText(draft.chore.days)) }
                Section("Who does it") {
                    Button { draft.chore.kids = [] } label: { check("Everyone", draft.chore.kids.isEmpty) }
                    ForEach(store.data.kids) { k in
                        Button {
                            if draft.chore.kids.contains(k.id) { draft.chore.kids.removeAll { $0 == k.id } } else { draft.chore.kids.append(k.id) }
                            if draft.chore.kids.count == store.data.kids.count { draft.chore.kids = [] }
                        } label: { check("\(k.avatar) \(k.name)", draft.chore.kids.contains(k.id)) }
                    }
                }
                Section {
                    Toggle("Only needs doing once a day", isOn: $draft.chore.once)
                        .tint(Theme.green).accessibilityIdentifier("onceChore")
                } footer: { Text("The first kid to do it gets it. Then it leaves the other kids' lists until tomorrow.") }
                Section {
                    Toggle("Special chore for a short time", isOn: Binding(
                        get: { !draft.chore.from.isEmpty || !draft.chore.until.isEmpty },
                        set: { on in
                            draft.chore.from = on ? dayKey(Date()) : ""
                            draft.chore.until = on ? dayKey(addDays(Date(), 6)) : ""
                        }))
                        .tint(Theme.green).accessibilityIdentifier("limitedChore")
                    if !draft.chore.from.isEmpty || !draft.chore.until.isEmpty {
                        DatePicker("First day", selection: Binding(
                            get: { parseDay(draft.chore.from.isEmpty ? dayKey(Date()) : draft.chore.from) },
                            set: { draft.chore.from = dayKey($0) }), displayedComponents: .date)
                        DatePicker("Last day", selection: Binding(
                            get: { parseDay(draft.chore.until.isEmpty ? dayKey(Date()) : draft.chore.until) },
                            set: { draft.chore.until = dayKey($0) }), displayedComponents: .date)
                    }
                } footer: { Text("A special chore shows on the charts only between its first and last day.") }
                if !draft.isNew {
                    Section { Button("Delete this chore", role: .destructive) { confirmDelete = true } }
                }
            }
            .navigationTitle(draft.isNew ? "Add a chore" : "Edit chore")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.bold()
                        .disabled(draft.chore.name.trimmingCharacters(in: .whitespaces).isEmpty || draft.chore.days.isEmpty)
                }
            }
            .confirmationDialog("Delete this chore?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { store.data.chores.removeAll { $0.id == draft.chore.id }; dismiss() }
            }
        }
    }

    private func check(_ label: String, _ on: Bool) -> some View {
        HStack { Text(label).foregroundStyle(.primary); Spacer(); if on { Image(systemName: "checkmark").foregroundStyle(Theme.purple).bold() } }
    }

    private func save() {
        var c = draft.chore
        c.name = c.name.trimmingCharacters(in: .whitespaces)
        if !c.from.isEmpty && !c.until.isEmpty && c.until < c.from { c.until = c.from }
        if let i = store.data.chores.firstIndex(where: { $0.id == c.id }) { store.data.chores[i] = c } else { store.data.chores.append(c) }
        dismiss()
    }
}

struct RewardDraft: Identifiable {
    var id: String
    var isNew: Bool
    var reward: Reward
    init(_ r: Reward?) {
        isNew = r == nil
        reward = r ?? Reward(pic: "🍦", name: "", cost: 10)
        id = reward.id
    }
}

struct RewardEditor: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    @State var draft: RewardDraft
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Picture") {
                    PicGrid(pics: rewardPics, selected: $draft.reward.pic) { _, label in
                        let wasDefault = rewardPics.contains { $0.1 == draft.reward.name }
                        if draft.reward.name.trimmingCharacters(in: .whitespaces).isEmpty || wasDefault { draft.reward.name = label }
                    }
                }
                Section("Name") { TextField("Ice cream trip", text: $draft.reward.name).font(.title3) }
                Section {
                    Stepper(store.data.settings.money ? "\(store.data.settings.amountText(draft.reward.cost)) (\(store.data.settings.coinCount(draft.reward.cost)))" : "⭐ \(draft.reward.cost)", value: $draft.reward.cost, in: 1...500).font(.title3.bold())
                    HStack {
                        Button("−5") { draft.reward.cost = max(1, draft.reward.cost - 5) }.buttonStyle(.bordered)
                        Spacer()
                        Button("+5") { draft.reward.cost = min(500, draft.reward.cost + 5) }.buttonStyle(.bordered)
                    }
                } header: { Text("Stars it costs") } footer: {
                    Text("Tip: a small treat that takes a few days to earn keeps young kids excited; save bigger trips for a week or two of chores.")
                }
                if !draft.isNew {
                    Section { Button("Delete this reward", role: .destructive) { confirmDelete = true } }
                }
            }
            .navigationTitle(draft.isNew ? "Add a reward" : "Edit reward")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.bold().disabled(draft.reward.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("Delete this reward?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { store.data.rewards.removeAll { $0.id == draft.reward.id }; dismiss() }
            }
        }
    }

    private func save() {
        var r = draft.reward
        r.name = r.name.trimmingCharacters(in: .whitespaces)
        if let i = store.data.rewards.firstIndex(where: { $0.id == r.id }) { store.data.rewards[i] = r } else { store.data.rewards.append(r) }
        dismiss()
    }
}

// MARK: - Special days

struct SpecialDraft: Identifiable {
    var id: String
    var isNew: Bool
    var day: SpecialDay
    init(_ x: SpecialDay?) {
        isNew = x == nil
        day = x ?? SpecialDay(pic: "🎂", name: "", date: dayKey(Date()))
        id = day.id
    }
}

/// "Everyone" plus one row per kid, with check marks. An empty list means everyone.
struct WhoPicker: View {
    @EnvironmentObject var store: JarStore
    @Binding var kids: [String]

    var body: some View {
        Button { kids = [] } label: { row("Everyone", kids.isEmpty) }
        ForEach(store.data.kids) { k in
            Button {
                if kids.contains(k.id) { kids.removeAll { $0 == k.id } } else { kids.append(k.id) }
                if kids.count == store.data.kids.count { kids = [] }
            } label: { row("\(k.avatar) \(k.name)", kids.contains(k.id)) }
        }
    }

    private func row(_ label: String, _ on: Bool) -> some View {
        HStack { Text(label).foregroundStyle(.primary); Spacer(); if on { Image(systemName: "checkmark").foregroundStyle(Theme.purple).bold() } }
    }
}

struct SpecialEditor: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    @State var draft: SpecialDraft
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Picture") {
                    PicGrid(pics: specialPics, selected: $draft.day.pic) { _, label in
                        let wasDefault = specialPics.contains { $0.1 == draft.day.name }
                        if draft.day.name.trimmingCharacters(in: .whitespaces).isEmpty || wasDefault { draft.day.name = label }
                    }
                }
                Section("Name (kids see this on the day)") {
                    TextField("Ava's birthday", text: $draft.day.name).font(.title3).accessibilityIdentifier("specialName")
                }
                Section("Which day") {
                    DatePicker("Day", selection: Binding(get: { parseDay(draft.day.date) }, set: { draft.day.date = dayKey($0) }), displayedComponents: .date)
                    Picker("Repeats", selection: $draft.day.yearly) {
                        Text("Every year").tag(true)
                        Text("Just this once").tag(false)
                    }
                    .pickerStyle(.segmented)
                }
                Section("What chores pay that day") {
                    Picker("Pay", selection: $draft.day.times) {
                        Text("Double").tag(2)
                        Text("Triple").tag(3)
                    }
                    .pickerStyle(.segmented)
                }
                Section("Who it's for") { WhoPicker(kids: $draft.day.kids) }
                if !draft.isNew {
                    Section { Button("Delete this special day", role: .destructive) { confirmDelete = true } }
                }
            }
            .navigationTitle(draft.isNew ? "Add a special day" : "Edit special day")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.bold().disabled(draft.day.name.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("saveSpecial")
                }
            }
            .confirmationDialog("Delete this special day?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { store.data.specials.removeAll { $0.id == draft.day.id }; dismiss() }
            }
        }
    }

    private func save() {
        var x = draft.day
        x.name = x.name.trimmingCharacters(in: .whitespaces)
        if let i = store.data.specials.firstIndex(where: { $0.id == x.id }) { store.data.specials[i] = x } else { store.data.specials.append(x) }
        dismiss()
    }
}

// MARK: - Matching

struct MatchDraft: Identifiable {
    var id: String
    var isNew: Bool
    var match: MatchOffer
    init(_ m: MatchOffer?) {
        isNew = m == nil
        match = m ?? MatchOffer(pic: "👵", who: "Grandma")
        id = match.id
    }
}

struct MatchEditor: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    @State var draft: MatchDraft
    @State private var confirmStop = false

    var body: some View {
        let s = store.data.settings
        NavigationStack {
            Form {
                Section("Who is matching") {
                    PicGrid(pics: matchPics, selected: $draft.match.pic) { _, label in
                        let wasDefault = matchPics.contains { $0.1 == draft.match.who }
                        if draft.match.who.trimmingCharacters(in: .whitespaces).isEmpty || wasDefault { draft.match.who = label }
                    }
                    TextField("Grandma", text: $draft.match.who).font(.title3).accessibilityIdentifier("matchWho")
                }
                Section {
                    Picker("How much", selection: $draft.match.percent) {
                        Text("A quarter").tag(25)
                        Text("Half").tag(50)
                        Text("The same").tag(100)
                        Text("Double").tag(200)
                        if !matchPercents.contains(draft.match.percent) { Text("\(draft.match.percent)%").tag(draft.match.percent) }
                    }
                    .pickerStyle(.segmented)
                } header: { Text("How much they add") } footer: {
                    Text(matchText(draft.match.who.trimmingCharacters(in: .whitespaces).isEmpty ? "they" : draft.match.who, draft.match.percent, s) + ".")
                }
                Section("Whose earnings they match") { WhoPicker(kids: $draft.match.kids) }
                Section {
                    Stepper(draft.match.cap == 0 ? "No limit" : s.amountShort(draft.match.cap), value: $draft.match.cap, in: 0...1000).font(.headline)
                    HStack {
                        Button("−5") { draft.match.cap = max(0, draft.match.cap - 5) }.buttonStyle(.bordered)
                        Spacer()
                        Button("+5") { draft.match.cap = min(1000, draft.match.cap + 5) }.buttonStyle(.bordered)
                    }
                } header: { Text("The most they will add for each kid") }
                Section {
                    Toggle("The match has a last day", isOn: Binding(
                        get: { !draft.match.until.isEmpty },
                        set: { draft.match.until = $0 ? dayKey(addDays(Date(), 30)) : "" }))
                        .tint(Theme.green)
                    if !draft.match.until.isEmpty {
                        DatePicker("Last day", selection: Binding(get: { parseDay(draft.match.until) }, set: { draft.match.until = dayKey($0) }), displayedComponents: .date)
                    }
                } footer: {
                    Text(draft.isNew ? "Matching starts with chores finished from now on." : given(s))
                }
                if !draft.isNew {
                    Section { Button("Stop this match", role: .destructive) { confirmStop = true } }
                }
            }
            .navigationTitle(draft.isNew ? "Add a match" : "Edit match")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.bold().disabled(draft.match.who.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("saveMatch")
                }
            }
            .confirmationDialog("Stop this match? What it already added stays in the jars.", isPresented: $confirmStop, titleVisibility: .visible) {
                Button("Stop the match", role: .destructive) { store.data.matches.removeAll { $0.id == draft.match.id }; dismiss() }
            }
        }
    }

    /// "Grandma has added 25¢ so far: Ava 15¢, Ben 10¢."
    private func given(_ s: Settings) -> String {
        let m = draft.match
        let parts = m.given.sorted { $0.key < $1.key }.compactMap { pair in store.data.kid(pair.key).map { "\($0.name) \(s.amountShort(pair.value))" } }
        return "\(m.who) has added \(s.amountText(m.totalGiven)) so far" + (parts.isEmpty ? "" : ": " + parts.joined(separator: ", ")) + "." + (s.money ? " That is what they owe the jar." : "")
    }

    private func save() {
        var m = draft.match
        m.who = m.who.trimmingCharacters(in: .whitespaces)
        if let i = store.data.matches.firstIndex(where: { $0.id == m.id }) {
            // keep the running totals: chores may have been OK'd while this sheet was open
            m.earned = store.data.matches[i].earned
            m.given = store.data.matches[i].given
            store.data.matches[i] = m
        } else {
            store.data.matches.append(m)
        }
        dismiss()
    }
}
