import Foundation
import UIKit
import Vision

/// Reads the words on a logbook page with Apple's built-in text reader, entirely on the iPhone.
/// Handles handwriting as well as stamped and printed entries.
enum PageReader {
    struct Word: Codable, Equatable {
        let text: String
        let conf: Double   // 0–100
        let x0: Double, y0: Double, x1: Double, y1: Double  // fractions of the page, top-left origin
    }

    static func read(_ image: UIImage) throws -> [Word] {
        guard let cg = image.normalizedUp().cgImage else { return [] }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false        // logbook codes and BuNos aren't English words
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.006             // small handwriting on a two-page spread
        if #available(iOS 16.0, *) { request.revision = VNRecognizeTextRequestRevision3 }
        request.customWords = ["AV-8B", "AV-8A", "TAV-8B", "TAV-8A", "AV-8C", "LHA", "LPH", "LHD", "CVN", "FCLP", "CQ", "NATOPS", "VMA", "VMAT", "TOTAL"]
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
        var words: [Word] = []
        for obs in request.results ?? [] {
            guard let cand = obs.topCandidates(1).first else { continue }
            let s = cand.string
            var idx = s.startIndex
            // one entry per word, each with its own box, so the screens can tell which column it sits in
            while idx < s.endIndex {
                while idx < s.endIndex, s[idx].isWhitespace { idx = s.index(after: idx) }
                guard idx < s.endIndex else { break }
                var end = idx
                while end < s.endIndex, !s[end].isWhitespace { end = s.index(after: end) }
                let range = idx..<end
                let box = (try? cand.boundingBox(for: range))?.boundingBox ?? obs.boundingBox
                words.append(Word(text: String(s[range]), conf: Double(cand.confidence) * 100,
                                  x0: Double(box.minX), y0: Double(1 - box.maxY), x1: Double(box.maxX), y1: Double(1 - box.minY)))
                idx = end
            }
        }
        return words
    }
}
