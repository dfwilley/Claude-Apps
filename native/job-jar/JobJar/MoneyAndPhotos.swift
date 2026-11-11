import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// MARK: - Coins

private func coinLabel(_ c: CoinKind) -> String { c.cents >= 100 ? "$1" : "\(c.cents)¢" }

/// One coin seen from above, used as a small icon.
struct CoinFace: View {
    let coin: CoinKind
    var size: CGFloat = 26

    var body: some View {
        ZStack {
            Circle().fill(Color(hex: coin.face))
            Circle().strokeBorder(Color(hex: coin.edge), lineWidth: size * 0.075)
            Circle().strokeBorder(Color(hex: coin.edge).opacity(0.6), lineWidth: 1).padding(size * 0.17)
            Text(coinLabel(coin)).font(.system(size: size * (coinLabel(coin).count > 2 ? 0.27 : 0.32), weight: .black)).foregroundStyle(Color(hex: coin.edge))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A stack of n coins seen from the side, 10 to a stack, drawn to scale (a nickel is bigger than a dime).
struct CoinStack: View {
    let coin: CoinKind
    let count: Int
    var scale: CGFloat = 1

    private var rx: CGFloat { CGFloat(coin.d) * 0.82 * scale }
    private var ry: CGFloat { rx * 0.36 }
    private var t: CGFloat { 5 * scale }
    private var gap: CGFloat { 4 * scale }
    private var cols: Int { max(1, Int((Double(count) / 10).rounded(.up))) }
    private var tallest: Int { min(count, 10) }
    private var size: CGSize {
        CGSize(width: CGFloat(cols) * rx * 2 + CGFloat(cols - 1) * gap + 4, height: CGFloat(max(tallest, 1) - 1) * t + ry * 2 + t + 4)
    }

    var body: some View {
        Canvas { ctx, sz in
            let face = Color(hex: coin.face), edge = Color(hex: coin.edge)
            for col in 0..<cols {
                let n = min(10, count - col * 10)
                let cx = 2 + rx + CGFloat(col) * (rx * 2 + gap)
                for i in 0..<max(n, 0) {
                    let cy = sz.height - 2 - ry - t - CGFloat(i) * t
                    ctx.fill(Path(ellipseIn: CGRect(x: cx - rx, y: cy + t - ry, width: rx * 2, height: ry * 2)), with: .color(edge))
                    ctx.fill(Path(CGRect(x: cx - rx, y: cy, width: rx * 2, height: t)), with: .color(edge))
                    let top = Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
                    ctx.fill(top, with: .color(face))
                    ctx.stroke(top, with: .color(edge), lineWidth: 1.2 * scale)
                    if i == n - 1 {
                        ctx.draw(Text(coinLabel(coin)).font(.system(size: ry * 1.1, weight: .black)).foregroundColor(edge), at: CGPoint(x: cx, y: cy))
                    }
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .accessibilityElement()
        .accessibilityLabel("\(count) \(count == 1 ? coin.name : coin.plural)")
    }
}

/// What a chore pays: a coin stack with "25¢" under it, or a row of stars.
struct PayView: View {
    @EnvironmentObject var store: JarStore
    let n: Int
    var scale: CGFloat = 1

    var body: some View {
        let s = store.data.settings
        if s.money {
            VStack(spacing: 2) {
                CoinStack(coin: s.coinKind, count: n, scale: scale)
                Text(money(n * s.coinKind.cents)).font(.system(size: 19 * min(scale, 1.3), weight: .black, design: .rounded))
            }
        } else {
            Text(n <= 5 ? String(repeating: "⭐", count: n) : "⭐ \(n)").font(.title3)
        }
    }
}

/// A kid's jar total: "⭐ 12" or a coin and "60¢".
struct BalanceView: View {
    @EnvironmentObject var store: JarStore
    let stars: Int
    var size: CGFloat = 22

    var body: some View {
        let s = store.data.settings
        HStack(spacing: 5) {
            if s.money {
                CoinFace(coin: s.coinKind, size: size * 1.1)
                Text(money(stars * s.coinKind.cents))
            } else {
                Text("⭐ \(stars)")
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(s.amountText(stars))
    }
}

// MARK: - Kid pictures

private var photoCache: [Int: UIImage] = [:]

func imageFromPhoto(_ p: String) -> UIImage? {
    guard !p.isEmpty, let comma = p.firstIndex(of: ",") else { return nil }
    let key = p.hashValue
    if let hit = photoCache[key] { return hit }
    guard let data = Data(base64Encoded: String(p[p.index(after: comma)...])), let img = UIImage(data: data) else { return nil }
    if photoCache.count > 40 { photoCache.removeAll() }
    photoCache[key] = img
    return img
}

/// Crops a picture to the middle square and shrinks it to 256 pixels so it saves quickly.
func photoString(from data: Data) -> String? {
    guard let img = UIImage(data: data) else { return nil }
    let side = min(img.size.width, img.size.height)
    guard side > 0 else { return nil }
    let out = CGSize(width: 256, height: 256)
    let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1; fmt.opaque = true
    let small = UIGraphicsImageRenderer(size: out, format: fmt).image { ctx in
        UIColor.white.setFill(); ctx.fill(CGRect(origin: .zero, size: out))
        let k = 256 / side
        let w = img.size.width * k, h = img.size.height * k
        img.draw(in: CGRect(x: (256 - w) / 2, y: (256 - h) / 2, width: w, height: h))
    }
    guard let jpg = small.jpegData(compressionQuality: 0.82) else { return nil }
    let s = "data:image/jpeg;base64," + jpg.base64EncodedString()
    return validPhoto(s) ? s : nil
}

/// The kid's photo in a circle, or their animal.
struct KidAvatar: View {
    let kid: Kid
    var size: CGFloat = 48

    var body: some View {
        Group {
            if let img = imageFromPhoto(kid.photo) {
                Image(uiImage: img).resizable().scaledToFill().frame(width: size, height: size).clipShape(Circle())
                    .overlay(Circle().stroke(Color(hex: kid.color), lineWidth: max(2, size * 0.05)))
            } else {
                Text(kid.avatar).font(.system(size: size * 0.9)).frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }
}

/// "Use a photo" and "Choose a file" buttons. Calls `picked` with the finished photo text.
struct PhotoImportButtons: View {
    let picked: (String) -> Void
    @State private var item: PhotosPickerItem?
    @State private var showFiles = false
    @State private var failed = false

    var body: some View {
        HStack(spacing: 10) {
            PhotosPicker(selection: $item, matching: .images) {
                Label("Use a photo", systemImage: "photo.on.rectangle").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            }
            .accessibilityIdentifier("usePhoto")
            Button { showFiles = true } label: {
                Label("Choose a file", systemImage: "folder").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.purple)
        .onChange(of: item) { newItem in
            guard let newItem else { return }
            Task {
                let data = try? await newItem.loadTransferable(type: Data.self)
                await MainActor.run {
                    if let data, let s = photoString(from: data) { picked(s) } else { failed = true }
                    item = nil
                }
            }
        }
        .fileImporter(isPresented: $showFiles, allowedContentTypes: [.image]) { result in
            guard case .success(let url) = result else { return }
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url), let s = photoString(from: data) { picked(s) } else { failed = true }
        }
        .alert("That picture couldn't be opened. Try a photo, or a JPEG or PNG file.", isPresented: $failed) { Button("OK") {} }
    }
}

/// Kids tap their own picture to change it: a photo, a picture file, or an animal.
struct MyPictureSheet: View {
    @EnvironmentObject var store: JarStore
    @EnvironmentObject var sync: SyncHub
    @Environment(\.dismiss) private var dismiss
    let kidId: String

    var body: some View {
        NavigationStack {
            ScrollView {
                if let i = store.data.kids.firstIndex(where: { $0.id == kidId }) {
                    let kid = store.data.kids[i]
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 16) {
                            KidAvatar(kid: kid, size: 96)
                            if !kid.photo.isEmpty {
                                Button("Remove photo") { sync.perform(SyncOp("picture", kid: kidId, photo: "")) }.buttonStyle(.bordered)
                            }
                        }
                        PhotoImportButtons { s in
                            sync.perform(SyncOp("picture", kid: kidId, photo: s))
                            store.say("Looking good!")
                            dismiss()
                        }
                        Text("Or pick an animal").font(.headline).foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 62), spacing: 8)], spacing: 8) {
                            ForEach(avatars, id: \.self) { a in
                                Button {
                                    sync.perform(SyncOp("picture", kid: kidId, avatar: a, photo: ""))
                                    dismiss()
                                } label: {
                                    Text(a).font(.system(size: 40)).frame(maxWidth: .infinity, minHeight: 62)
                                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(kid.photo.isEmpty && kid.avatar == a ? Theme.purple : .clear, lineWidth: 3))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .background(Theme.bg)
            .navigationTitle("Pick your picture")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.bold() } }
        }
        .onAppear { store.say("Pick your picture!") }
    }
}

/// Grown-up setting: stars or money, and which coin.
struct MoneySettings: View {
    @EnvironmentObject var store: JarStore

    var body: some View {
        Section {
            Toggle(isOn: $store.data.settings.money) {
                VStack(alignment: .leading) {
                    Text("Pay in money instead of stars")
                    Text("Each star becomes one coin. Kids see coin stacks and dollars and cents").font(.caption).foregroundStyle(.secondary)
                }
            }
            .tint(Theme.green)
            .accessibilityIdentifier("moneyMode")
            if store.data.settings.money {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                    ForEach(coins, id: \.key) { c in
                        Button { store.data.settings.coin = c.key } label: {
                            VStack(spacing: 3) {
                                CoinFace(coin: c, size: 44)
                                Text(c.name.prefix(1).uppercased() + c.name.dropFirst()).font(.subheadline.bold())
                                Text(money(c.cents)).font(.caption).foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(store.data.settings.coin == c.key ? Theme.purple : .clear, lineWidth: 3))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(c.name)
                        .accessibilityAddTraits(store.data.settings.coin == c.key ? .isSelected : [])
                        .accessibilityIdentifier("coin-\(c.key)")
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Text("Stars or money")
        } footer: {
            if store.data.settings.money {
                Text("Pick the one coin your family uses, then set how many of them each chore pays in Chores. Changing the coin changes what's already in each jar too (10 nickels become 10 dimes).")
            }
        }
    }
}
