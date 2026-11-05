import UIKit
import Vision

/// Reads a bin photo on the phone itself (no internet): printed words on labels and packages,
/// plus what kinds of things appear in it ("tool", "cable", "screwdriver").
enum PhotoAnalyzer {
    static func words(in image: UIImage) async -> [String] {
        guard let cg = image.cgImage else { return [] }
        return await withCheckedContinuation { cont in
            DispatchQueue.global(qos: .utility).async {
                cont.resume(returning: analyze(cg, orientation: CGImagePropertyOrientation(image.imageOrientation)))
            }
        }
    }

    private static let ignore: Set<String> = ["the", "and", "for", "with", "made", "inc", "www", "com", "usa", "net", "wt", "oz",
                                              "structure", "material", "indoor", "outdoor", "wood processed", "people", "adult"]

    static func analyze(_ cg: CGImage, orientation: CGImagePropertyOrientation) -> [String] {
        var out: [String] = []
        var seen = Set<String>()
        func add(_ w: String) {
            let k = BinSearch.normalize(w)
            guard k.count >= 3, !ignore.contains(k), !seen.contains(k), k.contains(where: { $0.isLetter }) else { return }
            seen.insert(k); out.append(w)
        }

        let handler = VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:])

        let text = VNRecognizeTextRequest()
        text.recognitionLevel = .accurate
        text.usesLanguageCorrection = true
        let classify = VNClassifyImageRequest()

        try? handler.perform([text])
        for obs in (text.results ?? []) {
            guard let s = obs.topCandidates(1).first, s.confidence > 0.3 else { continue }
            for w in s.string.split(whereSeparator: { !($0.isLetter || $0.isNumber || $0 == "-") }) { add(String(w).lowercased()) }
        }

        try? handler.perform([classify])
        for obs in (classify.results ?? []) where obs.confidence > 0.6 {
            add(obs.identifier.replacingOccurrences(of: "_", with: " "))
        }
        return out
    }
}

extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
