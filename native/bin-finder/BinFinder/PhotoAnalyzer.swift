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

    /// The kinds of things in a photo ("screwdriver", "hose", "bottle"), for the Scan photos checklist.
    static func objects(in image: UIImage) async -> [String] {
        guard let cg = image.cgImage else { return [] }
        return await withCheckedContinuation { cont in
            DispatchQueue.global(qos: .userInitiated).async {
                cont.resume(returning: objects(cg, orientation: CGImagePropertyOrientation(image.imageOrientation)))
            }
        }
    }

    /// Too general to be worth listing as something in a bin.
    private static let vague: Set<String> = ["container", "box", "bin", "storage", "tool", "tools", "equipment", "machine", "object", "plastic",
                                             "metal", "wood", "liquid", "food", "housewares", "office supplies", "textile", "interior room"]

    /// Looks at the whole picture and then at each quarter and each ninth of it, so small things in a full bin are noticed.
    static func objects(_ cg: CGImage, orientation: CGImagePropertyOrientation) -> [String] {
        let handler = VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:])
        var regions = [CGRect(x: 0, y: 0, width: 1, height: 1)]
        for n in [2, 3] {
            let side = 1 / CGFloat(n)
            for i in 0..<n { for j in 0..<n { regions.append(CGRect(x: CGFloat(i) * side, y: CGFloat(j) * side, width: side, height: side)) } }
        }
        var best: [String: Float] = [:]
        for region in regions {
            let request = VNClassifyImageRequest()
            request.regionOfInterest = region
            guard (try? handler.perform([request])) != nil else { continue }
            for obs in (request.results ?? []) where obs.confidence > 0.5 {
                let name = obs.identifier.replacingOccurrences(of: "_", with: " ")
                let k = BinSearch.normalize(name)
                if ignore.contains(k) || vague.contains(k) { continue }
                best[name] = max(best[name] ?? 0, obs.confidence)
            }
        }
        return best.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(20).map(\.key)
    }

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
