import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

/// QR labels. Each QR code holds binfinder://bin/<id>; scanning it with the iPhone Camera opens that bin.
enum Labels {
    static func qrImage(_ text: String, scale: CGFloat = 12) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage?.transformed(by: CGAffineTransform(scaleX: scale, y: scale)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }

    // Avery 5163 / 8163 shipping labels: 4 in × 2 in, 2 across × 5 down on US Letter.
    static let page = CGRect(x: 0, y: 0, width: 612, height: 792)
    static let labelSize = CGSize(width: 288, height: 144)
    static let leftMargin: CGFloat = 11.25, topMargin: CGFloat = 36, columnGap: CGFloat = 13.5
    static let perPage = 10

    static func labelRect(_ index: Int) -> CGRect {
        let slot = index % perPage, col = slot % 2, row = slot / 2
        return CGRect(x: leftMargin + CGFloat(col) * (labelSize.width + columnGap),
                      y: topMargin + CGFloat(row) * labelSize.height,
                      width: labelSize.width, height: labelSize.height)
    }

    /// A PDF of labels, ten to a page. `startAt` skips used label positions on a partly used sheet (0–9).
    static func pdf(for bins: [Bin], startAt: Int = 0, outlines: Bool = false) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        return renderer.pdfData { ctx in
            let skip = max(0, min(perPage - 1, startAt))
            for (n, bin) in bins.enumerated() {
                let i = n + skip
                if i % perPage == 0 || n == 0 { ctx.beginPage() }
                draw(bin, in: labelRect(i), context: ctx.cgContext, outline: outlines)
            }
            if bins.isEmpty { ctx.beginPage() }
        }
    }

    static func draw(_ bin: Bin, in r: CGRect, context cg: CGContext, outline: Bool) {
        if outline {
            cg.setStrokeColor(UIColor.lightGray.cgColor); cg.setLineWidth(0.5)
            cg.stroke(r.insetBy(dx: 0.5, dy: 0.5))
        }
        let pad: CGFloat = 12
        let qrSide = r.height - pad * 2
        if let qr = qrImage(BinLinks.url(for: bin.id).absoluteString) {
            cg.interpolationQuality = .none
            qr.draw(in: CGRect(x: r.minX + pad, y: r.minY + pad, width: qrSide, height: qrSide))
        }
        let textX = r.minX + pad * 2 + qrSide
        let width = r.maxX - pad - textX
        var y = r.minY + pad
        func put(_ s: String, _ font: UIFont, _ color: UIColor, maxHeight: CGFloat) {
            let p = NSMutableParagraphStyle(); p.lineBreakMode = .byTruncatingTail
            let a = NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color, .paragraphStyle: p])
            let h = min(maxHeight, a.boundingRect(with: CGSize(width: width, height: maxHeight), options: [.usesLineFragmentOrigin], context: nil).height.rounded(.up))
            a.draw(with: CGRect(x: textX, y: y, width: width, height: h), options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
            y += h + 2
        }
        put(bin.code, .systemFont(ofSize: 30, weight: .heavy), .black, maxHeight: 38)
        put(bin.displayName, .systemFont(ofSize: 15, weight: .semibold), .black, maxHeight: 38)
        if !bin.location.trimmed.isEmpty { put(bin.location, .systemFont(ofSize: 11), .darkGray, maxHeight: 15) }
        let hint = NSAttributedString(string: "Scan with iPhone Camera to see what's inside",
                                      attributes: [.font: UIFont.systemFont(ofSize: 7.5), .foregroundColor: UIColor.gray])
        hint.draw(with: CGRect(x: textX, y: r.maxY - pad - 10, width: width, height: 10), options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
    }

    /// Writes the PDF to a temporary file for sharing or printing.
    static func pdfFile(for bins: [Bin], name: String, startAt: Int = 0) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name.replacingOccurrences(of: "/", with: "-") + ".pdf")
        try pdf(for: bins, startAt: startAt).write(to: url, options: .atomic)
        return url
    }
}
