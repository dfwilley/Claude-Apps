import SwiftUI
import Speech
import AVFoundation

/// Listens for a few words ("spare fuses") and turns them into text. Uses the phone's own speech
/// recognition when it can (no internet needed); stops by itself after a short pause.
final class VoiceListener: ObservableObject {
    @Published var text = ""
    @Published var listening = false
    @Published var problem: String?
    /// Listened and stopped (heard something or gave up).
    @Published var finished = false

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var quietTimer: Timer?

    func start(hints: [String]) {
        text = ""; problem = nil; finished = false
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    self.problem = "Bin Finder needs Speech Recognition turned on: Settings › Bin Finder. Or type in the search box."
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    DispatchQueue.main.async {
                        if ok { self.begin(hints: hints) }
                        else { self.problem = "Bin Finder needs the microphone: Settings › Bin Finder › Microphone. Or type in the search box." }
                    }
                }
            }
        }
    }

    private func begin(hints: [String]) {
        guard let recognizer, recognizer.isAvailable else { problem = "Voice search isn't available right now. Type in the search box instead."; return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
            req.contextualStrings = Array(hints.prefix(100))
            request = req

            Self.installTap(on: engine.inputNode, feeding: req)
            engine.prepare()
            try engine.start()
            listening = true

            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                let heard = result?.bestTranscription.formattedString
                let final = result?.isFinal ?? false
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let heard, !heard.isEmpty { self.text = heard; self.waitForQuiet(1.6) }
                    if final || error != nil { self.stop() }
                }
            }
            waitForQuiet(7) // give up if nothing is said
        } catch {
            problem = "Couldn't start the microphone: \(error.localizedDescription)"
            stop()
        }
    }

    /// Kept off the main actor: the microphone calls this from its own thread.
    private static func installTap(on input: AVAudioInputNode, feeding req: SFSpeechAudioBufferRecognitionRequest) {
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in req.append(buffer) }
    }

    private func waitForQuiet(_ seconds: TimeInterval) {
        quietTimer?.invalidate()
        quietTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.stop() }
    }

    func stop() {
        quietTimer?.invalidate(); quietTimer = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio(); request = nil
        task?.finish(); task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if listening { finished = true }
        listening = false
    }

    deinit { quietTimer?.invalidate() }
}

/// Small sheet: "Listening…", the words as they're heard, then searches for them.
struct VoiceSearchSheet: View {
    @EnvironmentObject private var store: BinStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var voice = VoiceListener()
    @State private var started = false
    var onHeard: (String) -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: voice.listening ? "waveform" : "mic.fill")
                .font(.system(size: 40)).foregroundStyle(.tint)
                .frame(height: 48)
            if let problem = voice.problem {
                Text(problem).multilineTextAlignment(.center).foregroundStyle(.secondary)
            } else if voice.text.isEmpty {
                Text(voice.listening ? "Listening… say what you're looking for" : voice.finished ? "Didn't catch that." : "Starting the microphone…").foregroundStyle(.secondary)
                Text("Like “spare fuses” or “where's the sewer hose”").font(.footnote).foregroundStyle(.secondary)
            } else {
                Text("“\(voice.text)”").font(.title3.weight(.semibold)).multilineTextAlignment(.center)
            }
            HStack {
                Button("Cancel", role: .cancel) { voice.stop(); dismiss() }
                Spacer()
                if voice.listening {
                    Button("Done") { voice.stop() }.fontWeight(.semibold)
                } else if voice.finished {
                    Button("Try again") { voice.start(hints: hints) }
                }
            }
            .padding(.horizontal)
        }
        .padding()
        .onAppear { if !started { started = true; voice.start(hints: hints) } }
        .onDisappear { voice.stop() }
        .onChange(of: voice.listening) { on in
            // Finished listening: search for what was heard and close.
            let heard = voice.text.trimmingCharacters(in: CharacterSet(charactersIn: " .?!"))
            if !on, !heard.isEmpty {
                onHeard(heard)
                dismiss()
            }
        }
    }

    /// Words from the bins help the phone recognize unusual names ("Aeroshell", "Cleco").
    private var hints: [String] {
        Array(Set(store.bins.flatMap { [$0.name] + $0.items })).filter { !$0.isEmpty }
    }
}
