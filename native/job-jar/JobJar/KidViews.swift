import SwiftUI

private func starsText(_ n: Int) -> String { String(repeating: "⭐", count: max(0, n)) }

struct HomeView: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image("Logo").resizable().frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                Text("The Job Jar!").font(.system(size: 28, weight: .black, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
                Spacer()
                Button {
                    ui.askGrownUp(store, "Grown-ups only") {
                        GrownUpView.startOnCheck = !store.data.waitingList().isEmpty
                        ui.screen = .grownUps
                    }
                } label: {
                    Label("Grown-ups", systemImage: "lock.fill").font(.subheadline.bold()).foregroundStyle(.secondary)
                        .padding(.horizontal, 12).padding(.vertical, 9).background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityIdentifier("grownups")
            }
            .padding(.horizontal, 16).padding(.vertical, 10)

            ScrollView {
                if store.data.kids.isEmpty {
                    VStack(spacing: 10) {
                        Text("👋").font(.system(size: 80))
                        Text("No kids yet. A grown-up can add them in Grown-ups.").font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }.padding(.top, 60).padding(.horizontal)
                } else {
                    Text("Who's helping today?").font(.system(size: 26, weight: .heavy, design: .rounded)).foregroundStyle(.secondary).padding(.top, 8)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 16)], spacing: 16) {
                        ForEach(store.data.kids) { k in KidTile(kid: k) }
                    }
                    .padding(16)
                    .frame(maxWidth: 1100)
                }
            }
        }
    }
}

struct KidTile: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState
    let kid: Kid

    var body: some View {
        let p = store.data.progress(kid.id, store.today)
        Button {
            ui.screen = .kid(kid.id)
            store.say("Hi \(kid.name)!")
        } label: {
            VStack(spacing: 6) {
                KidAvatar(kid: kid, size: 90)
                Text(kid.name).font(.system(size: 26, weight: .black, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                BalanceView(stars: kid.stars).font(.title3.weight(.heavy))
                ProgressView(value: Double(p.finished), total: Double(max(p.total, 1))).tint(Theme.green).scaleEffect(x: 1, y: 2.2).padding(.horizontal, 10).padding(.top, 6)
            }
            .foregroundStyle(.primary)
            .padding(.vertical, 20).padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).stroke(Color(hex: kid.color), lineWidth: 6))
            .shadow(color: .black.opacity(0.07), radius: 8, y: 4)
        }
        .buttonStyle(Squish())
        .accessibilityLabel("\(kid.name), \(store.data.settings.amountText(kid.stars))")
        .accessibilityIdentifier("kid-\(kid.name)")
    }
}

struct Squish: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.96 : 1).animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

enum KidTab { case today, prizes, week }

struct KidView: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState
    let kidId: String
    @State private var tab: KidTab = .today
    @State private var picking = false

    var body: some View {
        if let kid = store.data.kid(kidId) {
            let color = Color(hex: kid.color)
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Button { ui.screen = .home } label: {
                        Image(systemName: "house.fill").font(.title2).frame(width: 56, height: 56).background(Theme.card, in: Circle())
                    }
                    .accessibilityLabel("Home").accessibilityIdentifier("home")
                    Button { picking = true } label: { KidAvatar(kid: kid, size: 54) }
                        .accessibilityLabel("Change my picture").accessibilityIdentifier("myPicture")
                    Text(kid.name).font(.system(size: 28, weight: .black, design: .rounded)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.6)
                    Spacer()
                    BalanceView(stars: kid.stars).font(.title2.weight(.black)).padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Theme.goldSoft, in: Capsule())
                        .accessibilityIdentifier("starCount")
                }
                .padding(.horizontal, 16).padding(.vertical, 10)

                ScrollView {
                    Group {
                        switch tab {
                        case .today: TodayGrid(kid: kid)
                        case .prizes: PrizesGrid(kid: kid)
                        case .week: WeekGrid(kid: kid)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: 1100)
                    .frame(maxWidth: .infinity)
                }

                HStack(spacing: 10) {
                    tabButton(.today, "✅", "Today", color)
                    tabButton(.prizes, "🎁", "Prizes", color)
                    tabButton(.week, "📅", "My week", color)
                }
                .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 6)
                .background(.ultraThinMaterial)
            }
            .sheet(isPresented: $picking) { MyPictureSheet(kidId: kidId).environmentObject(store) }
        }
    }

    private func tabButton(_ t: KidTab, _ icon: String, _ label: String, _ color: Color) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 2) {
                Text(icon).font(.system(size: 32))
                Text(label).font(.headline.weight(.heavy))
            }
            .frame(maxWidth: 200).frame(maxWidth: .infinity).padding(.vertical, 8)
            .foregroundStyle(tab == t ? .white : .secondary)
            .background(tab == t ? color : Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .accessibilityIdentifier("tab-\(label)")
        .accessibilityAddTraits(tab == t ? .isSelected : [])
    }
}

struct TodayGrid: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState
    let kid: Kid
    @State private var asking: Chore?

    var body: some View {
        let list = store.data.choresFor(kid.id, store.today)
        VStack(spacing: 16) {
            if store.data.progress(kid.id, store.today).allDone {
                Text("🎉 All done today! 🎉").font(.system(size: 26, weight: .black, design: .rounded)).foregroundStyle(Color(hex: "#4A2E00"))
                    .frame(maxWidth: .infinity).padding(18)
                    .background(LinearGradient(colors: [Color(hex: "#FFE45C"), Theme.gold], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22))
                    .accessibilityIdentifier("allDone")
            }
            if list.isEmpty {
                VStack { Text("🌈").font(.system(size: 80)); Text("No chores today. Enjoy!").font(.title3).foregroundStyle(.secondary) }.padding(.top, 40)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 158), spacing: 16)], spacing: 16) {
                ForEach(list) { item in
                    ChoreCard(chore: item.chore, status: item.status) { tap(item.chore, item.status) }
                }
            }
        }
        .sheet(item: $asking) { c in
            UndoSheet(chore: c, status: store.data.status(kid.id, c.id, store.today)) {
                store.data.undo(kid.id, c.id, store.today)
                asking = nil
            } keep: { asking = nil }
            .presentationDetents([.medium])
        }
    }

    private func tap(_ c: Chore, _ st: ChoreStatus) {
        if st != .todo {
            asking = c
            store.say(st == .done ? "\(c.name). Done!" : "\(c.name). Waiting for a grown-up.")
            return
        }
        let got = store.data.markDone(kid.id, c.id, store.today)
        store.ding()
        if store.data.progress(kid.id, store.today).allDone {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { store.fanfare() }
            ui.celebrate("🏆", "All done today!", got > 0 ? "+" + store.data.settings.amountText(got) : "", big: true)
            store.say("Great job \(kid.name)! All your chores are done!")
        } else if got > 0 {
            ui.celebrate(c.pic, "Great job!", "+" + store.data.settings.amountText(got))
            store.say("\(c.name). Great job! \(store.data.settings.amountSpeech(got))!")
        } else {
            ui.celebrate("⏳", "Nice work!", "A grown-up will check it")
            store.say("Nice work! A grown-up will check it.")
        }
    }
}

struct ChoreCard: View {
    @EnvironmentObject var store: JarStore
    let chore: Chore
    let status: ChoreStatus
    let action: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            VStack(spacing: 6) {
                Text(chore.pic).font(.system(size: 80)).opacity(status == .done ? 0.8 : 1)
                Text(chore.name).font(.system(size: 20, weight: .heavy, design: .rounded)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                PayView(n: chore.stars)
            }
            .padding(.horizontal, 8).padding(.vertical, 18)
            .frame(maxWidth: .infinity, minHeight: 200)
            .background(status == .done ? Theme.greenSoft : status == .waiting ? Theme.waitSoft : Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(status == .done ? Theme.green : status == .waiting ? Theme.gold : .clear, lineWidth: 5))
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(chore.name + (status == .done ? ", done" : status == .waiting ? ", waiting for a grown-up" : ""))
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { action() }
            .accessibilityIdentifier("chore-\(chore.name)")

            HStack {
                if status != .todo {
                    Text(status == .done ? "✓" : "⏳").font(.system(size: status == .done ? 30 : 24, weight: .black)).foregroundStyle(.white)
                        .frame(width: 50, height: 50).background(status == .done ? Theme.green : Theme.gold, in: Circle())
                        .accessibilityHidden(true)
                }
                Spacer()
                Button { store.say(chore.name) } label: {
                    Image(systemName: "speaker.wave.2.fill").font(.title3).frame(width: 46, height: 46).background(Theme.bg, in: Circle())
                }
                .accessibilityLabel("Say \(chore.name)")
            }
            .padding(8)
        }
        .shadow(color: .black.opacity(0.07), radius: 8, y: 4)
    }
}

struct UndoSheet: View {
    let chore: Chore
    let status: ChoreStatus
    let undo: () -> Void
    let keep: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text(chore.pic).font(.system(size: 80))
            Text(chore.name).font(.system(size: 26, weight: .bold, design: .rounded))
            HStack(spacing: 12) {
                Button(action: undo) {
                    Text("↩️ Not done yet").font(.title3.bold()).frame(maxWidth: .infinity).padding(.vertical, 18)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                }
                .accessibilityIdentifier("notDoneYet")
                Button(action: keep) {
                    Text(status == .done ? "✓ It's done!" : "⏳ Keep waiting").font(.title3.bold()).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 18)
                        .background(Theme.green, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
        .padding(24)
        .fontDesign(.rounded)
    }
}

struct PrizesGrid: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var ui: UIState
    let kid: Kid

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 14) {
                Image("Logo").resizable().frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading) {
                    BalanceView(stars: kid.stars, size: 34).font(.system(size: 38, weight: .black, design: .rounded))
                    Text("\(store.data.settings.money ? "in" : kid.stars == 1 ? "star in" : "stars in") \(kid.name)'s jar").font(.headline).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(16).background(Theme.card, in: RoundedRectangle(cornerRadius: 22))

            if store.data.rewards.isEmpty {
                VStack { Text("🎁").font(.system(size: 80)); Text("No rewards yet. Ask a grown-up to add some!").font(.title3).foregroundStyle(.secondary) }.padding(.top, 30)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], spacing: 16) {
                ForEach(store.data.rewards) { r in prize(r) }
            }
        }
    }

    @ViewBuilder private func prize(_ r: Reward) -> some View {
        let ready = kid.stars >= r.cost
        VStack(spacing: 8) {
            Text(r.pic).font(.system(size: 72))
            Text(r.name).font(.system(size: 20, weight: .heavy, design: .rounded)).multilineTextAlignment(.center)
            let s = store.data.settings
            if s.money { Text("Costs " + s.amountText(r.cost)).font(.title3.weight(.black)) }
            if r.cost <= 20 && !s.money {
                LazyVGrid(columns: Array(repeating: GridItem(.fixed(20), spacing: 2), count: 8), spacing: 2) {
                    ForEach(0..<r.cost, id: \.self) { i in
                        Text("⭐").font(.system(size: 17)).grayscale(i < kid.stars ? 0 : 1).opacity(i < kid.stars ? 1 : 0.3)
                    }
                }
                .frame(maxWidth: 180)
                .accessibilityHidden(true)
            } else {
                ProgressView(value: Double(min(kid.stars, r.cost)), total: Double(r.cost)).tint(Theme.gold).scaleEffect(x: 1, y: 3)
            }
            Text(ready ? "You have enough!" : s.money ? "\(s.amountText(min(kid.stars, r.cost))) of \(s.amountText(r.cost))" : "\(min(kid.stars, r.cost)) of \(r.cost) ⭐").font(.headline).foregroundStyle(.secondary)
            if ready {
                Button { get(r) } label: {
                    Text("Get it!").font(.title2.weight(.black)).foregroundStyle(Color(hex: "#3A2400")).padding(.horizontal, 26).padding(.vertical, 12)
                        .background(Theme.gold, in: Capsule())
                }
                .accessibilityIdentifier("get-\(r.name)")
            } else {
                Button { store.say("\(r.name). \(s.amountSpeech(r.cost - kid.stars)) to go.") } label: {
                    Image(systemName: "speaker.wave.2.fill").font(.title3).frame(width: 46, height: 46).background(Theme.bg, in: Circle())
                }
                .accessibilityLabel("Say \(r.name)")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(ready ? Theme.gold : .clear, lineWidth: 5))
    }

    private func get(_ r: Reward) {
        store.say("Ask a grown-up for \(r.name)!")
        let kidId = kid.id
        ui.askGrownUp(store, "Grown-up: OK \(r.name) for \(kid.name)?") {
            if store.data.redeem(kidId, r.id) {
                store.fanfare()
                ui.celebrate(r.pic, r.name + "!", "−" + store.data.settings.amountText(r.cost), big: true)
                store.say("Hooray! \(r.name)!")
            }
        }
    }
}

struct WeekGrid: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.horizontalSizeClass) private var sizeClass
    let kid: Kid

    var body: some View {
        let wk = store.data.weekChart(kid.id, store.today)
        let todayKey = dayKey(store.today)
        let color = Color(hex: kid.color)
        VStack(spacing: 14) {
            if wk.rows.isEmpty {
                VStack { Text("📅").font(.system(size: 80)); Text("No chores yet.").font(.title3).foregroundStyle(.secondary) }.padding(.top, 30)
            } else {
                Grid(horizontalSpacing: 4, verticalSpacing: 4) {
                    GridRow {
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                        ForEach(0..<7, id: \.self) { i in
                            Text(dayLetters[i]).font(.headline.weight(.heavy)).foregroundStyle(wk.days[i] == todayKey ? .white : .secondary)
                                .frame(maxWidth: .infinity, minHeight: 32)
                                .background(wk.days[i] == todayKey ? color : .clear, in: RoundedRectangle(cornerRadius: 10))
                                .accessibilityLabel(dayNames[i])
                        }
                    }
                    ForEach(wk.rows) { row in
                        GridRow {
                            HStack(spacing: 4) {
                                Text(row.chore.pic).font(.system(size: 32))
                                if sizeClass == .regular { Text(row.chore.name).font(.subheadline.bold()).foregroundStyle(.secondary).lineLimit(1) }
                            }
                            .frame(maxWidth: 200, alignment: .leading)
                            .accessibilityElement(children: .ignore).accessibilityLabel(row.chore.name)
                            ForEach(0..<7, id: \.self) { i in cell(row.cells[i], today: wk.days[i] == todayKey, color: color) }
                        }
                    }
                    GridRow {
                        Text(store.data.settings.money ? "Earned" : "Stars").font(.subheadline.bold()).foregroundStyle(.secondary).frame(maxWidth: 200, alignment: .leading)
                        ForEach(0..<7, id: \.self) { i in
                            Text(wk.earned[i] == 0 ? "" : store.data.settings.money ? store.data.settings.amountText(wk.earned[i]) : "\(wk.earned[i])").font(.headline.weight(.black)).minimumScaleFactor(0.5).lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 40).background(Theme.goldSoft, in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }
                .padding(10)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 22))
                Text("This week: " + store.data.settings.amountShort(wk.total)).font(.system(size: 24, weight: .black, design: .rounded))
            }
        }
    }

    @ViewBuilder private func cell(_ c: WeekCell, today: Bool, color: Color) -> some View {
        let symbol: String = { switch c { case .done: return "⭐"; case .waiting: return "⏳"; case .todo: return "○"; default: return "" } }()
        Group {
            if c == .done && store.data.settings.money { CoinFace(coin: store.data.settings.coinKind, size: 28) }
            else { Text(symbol).font(.system(size: 22)).foregroundStyle(Color.secondary.opacity(0.4)) }
        }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(c == .off ? Color.clear : Theme.bg, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(today ? color : .clear, lineWidth: 3))
    }
}

struct CelebrationView: View {
    let party: Party
    @State private var go = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.black.opacity(0.3).ignoresSafeArea()
            if !reduceMotion {
                let n = party.big ? 22 : 10
                ForEach(0..<n, id: \.self) { i in
                    let a = Double(i) / Double(n) * .pi * 2
                    let dist: Double = party.big ? 300 : 210
                    Text(party.big && i % 5 == 0 ? "🎉" : "⭐").font(.system(size: 44))
                        .offset(x: go ? cos(a) * dist : 0, y: go ? sin(a) * dist : 0)
                        .scaleEffect(go ? 1.2 : 0.4)
                        .rotationEffect(.degrees(go ? Double(i * 47 % 360) : 0))
                        .opacity(go ? 0 : 1)
                }
            }
            VStack(spacing: 4) {
                Text(party.pic).font(.system(size: 92))
                Text(party.title).font(.system(size: 32, weight: .black, design: .rounded)).multilineTextAlignment(.center)
                if !party.sub.isEmpty { Text(party.sub).font(.system(size: 24, weight: .heavy, design: .rounded)).foregroundStyle(Theme.gold) }
            }
            .padding(.horizontal, 34).padding(.vertical, 26)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
            .scaleEffect(go || reduceMotion ? 1 : 0.4)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("celebration")
        }
        .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.6)) { go = true } }
        .id(party.id)
    }
}
