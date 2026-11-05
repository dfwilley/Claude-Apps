import SwiftUI

/// The grown-up PIN pad (check or set a PIN), or a simple confirm when there's no PIN.
struct GateView: View {
    @EnvironmentObject var store: JarStore
    @Environment(\.dismiss) private var dismiss
    let gate: Gate

    @State private var entry = ""
    @State private var first = ""
    @State private var message = ""
    @State private var shake = false
    @State private var forgot = false
    @State private var setNew = false
    @State private var answer = ""
    @State private var question = (a: 12 + Int.random(in: 0...6), b: 6 + Int.random(in: 0...3))

    private var setting: Bool { gate.mode == .set || setNew }

    var body: some View {
        VStack(spacing: 14) {
            HStack { Spacer(); Button("Cancel") { dismiss() }.font(.headline) }
            if gate.mode == .confirm && !setNew {
                confirmView
            } else if forgot {
                forgotView
            } else {
                padView
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .fontDesign(.rounded)
        .presentationDetents([.large])
        .interactiveDismissDisabled(false)
    }

    private var confirmView: some View {
        VStack(spacing: 16) {
            Text("🔓").font(.system(size: 54))
            Text(gate.title).font(.title2.bold()).multilineTextAlignment(.center)
            Text("No grown-up PIN is set, so anyone can do this. You can add a PIN in Grown-ups › Settings.")
                .foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button {
                dismiss(); gate.done("")
            } label: {
                Text("OK, go ahead").font(.title3.bold()).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(Theme.purple, in: RoundedRectangle(cornerRadius: 16))
            }
            .accessibilityIdentifier("confirmGrownUp")
        }
    }

    private var forgotView: some View {
        VStack(spacing: 16) {
            Text("Reset the grown-up PIN").font(.title2.bold())
            Text("To make sure you're a grown-up: what is \(question.a) × \(question.b)?").foregroundStyle(.secondary).multilineTextAlignment(.center)
            TextField("Answer", text: $answer).keyboardType(.numberPad).font(.title2).multilineTextAlignment(.center)
                .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            if !message.isEmpty { Text(message).foregroundStyle(Theme.red).bold() }
            Button {
                if Int(answer.trimmingCharacters(in: .whitespaces)) == question.a * question.b {
                    forgot = false; setNew = true; entry = ""; first = ""; message = ""
                } else { message = "That's not right." }
            } label: {
                Text("Next").font(.title3.bold()).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.purple, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    private var padView: some View {
        VStack(spacing: 12) {
            Text("🔒").font(.system(size: 54))
            Text(setting ? (first.isEmpty ? (setNew ? "Pick a new 4-number PIN" : gate.title) : "Type the same 4 numbers again") : gate.title)
                .font(.title2.bold()).multilineTextAlignment(.center)
            HStack(spacing: 14) {
                ForEach(0..<4, id: \.self) { i in
                    Circle().strokeBorder(Theme.purple, lineWidth: 3)
                        .background(Circle().fill(i < entry.count ? Theme.purple : .clear))
                        .frame(width: 22, height: 22)
                }
            }
            .padding(.vertical, 8)
            .offset(x: shake ? -10 : 0)
            .animation(shake ? .default.repeatCount(3, autoreverses: true).speed(4) : .default, value: shake)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(entry.count) of 4 numbers entered")
            Text(message).foregroundStyle(Theme.red).bold().frame(minHeight: 22)
            let rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]
            VStack(spacing: 12) {
                ForEach(rows, id: \.self) { row in
                    HStack(spacing: 14) {
                        ForEach(row, id: \.self) { k in
                            if k.isEmpty { Color.clear.frame(width: 76, height: 76) } else {
                                Button { press(k) } label: {
                                    Text(k).font(.system(size: 30, weight: .bold, design: .rounded)).frame(width: 76, height: 76)
                                        .background(Theme.card, in: Circle()).foregroundStyle(.primary)
                                }
                                .accessibilityLabel(k == "⌫" ? "Delete" : k)
                                .accessibilityIdentifier("pin-\(k)")
                            }
                        }
                    }
                }
            }
            if !setting {
                Button("Forgot the PIN?") { forgot = true; message = "" }.font(.headline).padding(.top, 6)
            }
        }
    }

    private func press(_ k: String) {
        if k == "⌫" { if !entry.isEmpty { entry.removeLast() }; return }
        guard entry.count < 4 else { return }
        entry += k
        message = ""
        guard entry.count == 4 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { finishEntry() }
    }

    private func finishEntry() {
        if !setting {
            if entry == store.data.settings.pin { dismiss(); gate.done(entry) }
            else { entry = ""; message = "That's not it. Try again."; shake.toggle() }
            return
        }
        if first.isEmpty { first = entry; entry = ""; return }
        if entry == first {
            let pin = entry
            dismiss()
            if setNew { store.data.settings.pin = pin }
            gate.done(pin)
        } else {
            first = ""; entry = ""; message = "Those didn't match. Start again."; shake.toggle()
        }
    }
}
