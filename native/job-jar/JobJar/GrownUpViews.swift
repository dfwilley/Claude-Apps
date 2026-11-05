import SwiftUI
import UniformTypeIdentifiers

enum GUTab: String, CaseIterable, Identifiable {
    case check = "✅ Check", kids = "👧 Kids", chores = "🧹 Chores", rewards = "🎁 Rewards", history = "📜 History", settings = "⚙️ Settings"
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
    @State private var historyKid = ""
    @State private var showRestore = false
    @State private var shareURL: URL?
    @State private var confirmErase = false
    @State private var alertText: String?

    private var tabs: [GUTab] {
        let showCheck = store.data.settings.needsApproval || !store.data.waitingList().isEmpty
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
                                    if t == .check, store.data.waitingList().count > 0 {
                                        Text("\(store.data.waitingList().count)").font(.caption.bold()).foregroundStyle(.white)
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
            case .kids: kidsTab
            case .chores: choresTab
            case .rewards: rewardsTab
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
        Section {
            if waiting.isEmpty {
                Text("👍 Nothing waiting to be checked.").foregroundStyle(.secondary)
            }
            ForEach(waiting) { w in
                let k = store.data.kid(w.kidId)
                HStack(spacing: 12) {
                    Text(w.chore.pic).font(.system(size: 34))
                    VStack(alignment: .leading) {
                        Text(w.chore.name).font(.headline)
                        Text("\(k?.photo.isEmpty == false ? "" : k?.avatar ?? "") \(k?.name ?? "") · \(w.day == dayKey(store.today) ? "today" : longDay(w.day))").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { store.data.reject(w.kidId, w.chore.id, w.day) } label: { Image(systemName: "xmark").font(.headline).padding(10) }
                        .buttonStyle(.bordered).accessibilityLabel("Not done")
                    Button { store.data.approve(w.kidId, w.chore.id, w.day); store.ding() } label: { Text("✓ " + (store.data.settings.money ? store.data.settings.amountText(w.chore.stars) : String(repeating: "⭐", count: w.chore.stars))).font(.headline) }
                        .buttonStyle(.borderedProminent).tint(Theme.green).accessibilityIdentifier("approve")
                }
            }
            if waiting.count > 1 {
                Button("✓ OK all of them") {
                    for w in store.data.waitingList() { store.data.approve(w.kidId, w.chore.id, w.day) }
                    store.fanfare()
                }.bold()
            }
        } footer: {
            Text("“Grown-up checks chores first” is \(store.data.settings.needsApproval ? "on" : "off") (Settings). When it's on, a chore turns yellow ⏳ until you OK it here, then the stars go in the jar.")
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
                            Text("\(daysText(c.days)) · \(whoText(c.kids))").font(.subheadline).foregroundStyle(.secondary)
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
                VStack(alignment: .leading) { Text("Grown-up checks chores first"); Text("Stars go in the jar after you OK each chore").font(.caption).foregroundStyle(.secondary) }
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

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 54), spacing: 6)], spacing: 6) {
            ForEach(pics, id: \.0) { p in
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
    init(_ c: Chore?) {
        isNew = c == nil
        chore = c ?? Chore(pic: "🛏️", name: "")
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
