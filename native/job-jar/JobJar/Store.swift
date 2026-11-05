import SwiftUI
import AVFoundation
import UIKit

/// Holds the app's data and saves it to a file in the app's Documents folder after every change.
final class JarStore: ObservableObject {
    @Published var data: AppData { didSet { if data != oldValue { save() } } }
    @Published var today = Date()

    private let file: URL?

    init(file: URL?) {
        self.file = file
        if let file, let raw = try? Data(contentsOf: file), let d = try? JSONDecoder().decode(AppData.self, from: raw) {
            data = d
        } else {
            data = AppData.starter()
        }
        data.prune(Date())
    }

    static func documentsFile() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("jobjar.json")
    }

    private func save() {
        guard let file else { return }
        do {
            let enc = JSONEncoder()
            enc.outputFormatting = [.sortedKeys]
            try enc.encode(data).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            print("Could not save: \(error)")
        }
    }

    /// Call when the app comes back to the front, or every so often, so a new day starts a fresh chart.
    func refreshDay() {
        let now = Date()
        if dayKey(now) != dayKey(today) {
            today = now
            data.prune(now)
        }
    }

    func backupData() -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return (try? enc.encode(data)) ?? Data()
    }

    /// Replaces everything with a backup file (from this app or the web app). Throws if it isn't a Job Jar backup.
    func restore(from raw: Data) throws {
        guard let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any], obj["kids"] is [Any], obj["chores"] is [Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        var d = try JSONDecoder().decode(AppData.self, from: raw)
        d.setupDone = true
        d.prune(Date())
        data = d
    }

    // MARK: sound, voice, haptics

    private let voice = AVSpeechSynthesizer()
    private var player: AVAudioPlayer?

    func say(_ text: String) {
        guard data.settings.speak else { return }
        activateAudio()
        voice.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: text)
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
        u.pitchMultiplier = 1.15
        u.voice = AVSpeechSynthesisVoice(language: "en-US")
        voice.speak(u)
    }

    func ding() { play([784, 1175], step: 0.11); haptic(.success) }
    func fanfare() { play([523, 659, 784, 1047, 784, 1047], step: 0.12); haptic(.success) }

    private func haptic(_ t: UINotificationFeedbackGenerator.FeedbackType) { UINotificationFeedbackGenerator().notificationOccurred(t) }

    private func activateAudio() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    /// Plays a short chime made on the spot (no sound files needed), like the web app's.
    private func play(_ freqs: [Double], step: Double) {
        guard data.settings.sound else { return }
        activateAudio()
        player = try? AVAudioPlayer(data: Self.chime(freqs, step: step))
        player?.volume = 0.6
        player?.play()
    }

    static func chime(_ freqs: [Double], step: Double, rate: Double = 44100) -> Data {
        let total = Int(rate * (step * Double(freqs.count) + step * 2))
        var samples = [Double](repeating: 0, count: total)
        for (i, f) in freqs.enumerated() {
            let start = Int(Double(i) * step * rate), len = Int(step * 2 * rate)
            for n in 0..<len where start + n < total {
                let t = Double(n) / rate
                let attack = min(1, t / 0.02), decay = exp(-t * 3.2 / (step * 2))
                // triangle wave
                let ph = (t * f).truncatingRemainder(dividingBy: 1)
                let tri = 4 * abs(ph - 0.5) - 1
                samples[start + n] += tri * attack * decay * 0.3
            }
        }
        var pcm = Data(capacity: total * 2)
        for s in samples {
            let v = Int16(max(-1, min(1, s)) * 32767)
            withUnsafeBytes(of: v.littleEndian) { pcm.append(contentsOf: $0) }
        }
        var wav = Data()
        func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { wav.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { wav.append(contentsOf: $0) } }
        wav.append(contentsOf: Array("RIFF".utf8)); u32(UInt32(36 + pcm.count)); wav.append(contentsOf: Array("WAVE".utf8))
        wav.append(contentsOf: Array("fmt ".utf8)); u32(16); u16(1); u16(1); u32(UInt32(rate)); u32(UInt32(rate) * 2); u16(2); u16(16)
        wav.append(contentsOf: Array("data".utf8)); u32(UInt32(pcm.count)); wav.append(pcm)
        return wav
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0x6A5AE0
        self.init(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

enum Theme {
    static let purple = Color(hex: "#6A5AE0")
    static let gold = Color(hex: "#FFB000")
    static let green = Color(hex: "#2FBF71")
    static let red = Color(hex: "#E0444E")
    static let bg = Color("Background")
    static let card = Color("Card")
    static let goldSoft = Color("GoldSoft")
    static let greenSoft = Color("GreenSoft")
    static let waitSoft = Color("WaitSoft")
    static let rounded = Font.Design.rounded
}
