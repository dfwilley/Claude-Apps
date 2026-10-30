import SwiftUI
import UIKit

/// The iPhone camera, returning one photo.
struct CameraPicker: UIViewControllerRepresentable {
    var onPhoto: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }
    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onPhoto(img) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

/// iOS share sheet: save to Files, AirDrop, Print, Messages, Mail…
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// Full-screen photo with pinch to zoom.
struct PhotoViewer: View {
    @EnvironmentObject private var store: BinStore
    @Environment(\.dismiss) private var dismiss
    let name: String
    let binID: UUID
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var confirm = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let img = store.image(name) {
                Image(uiImage: img).resizable().scaledToFit()
                    .scaleEffect(scale).offset(offset)
                    .gesture(MagnificationGesture()
                        .onChanged { scale = max(1, min(6, lastScale * $0)) }
                        .onEnded { _ in lastScale = scale; if scale == 1 { offset = .zero; lastOffset = .zero } })
                    .simultaneousGesture(DragGesture()
                        .onChanged { v in if scale > 1 { offset = CGSize(width: lastOffset.width + v.translation.width, height: lastOffset.height + v.translation.height) } }
                        .onEnded { _ in lastOffset = offset })
                    .onTapGesture(count: 2) { withAnimation { scale = scale > 1 ? 1 : 2.5; lastScale = scale; if scale == 1 { offset = .zero; lastOffset = .zero } } }
                    .accessibilityLabel("Bin photo")
            }
        }
        .overlay(alignment: .top) {
            HStack {
                Button(role: .destructive) { confirm = true } label: { Label("Delete photo", systemImage: "trash") }
                Spacer()
                Button("Done") { dismiss() }.fontWeight(.semibold)
            }
            .padding()
            .foregroundStyle(.white)
            .background(.black.opacity(0.35))
        }
        .confirmationDialog("Delete this photo?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { store.removePhoto(name, from: binID); dismiss() }
        }
    }
}

/// One bin's QR label, ready to print.
struct LabelView: View {
    @Environment(\.dismiss) private var dismiss
    let bin: Bin
    @State private var startAt = 0
    @State private var share: ShareItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(spacing: 10) {
                        if let qr = Labels.qrImage(BinLinks.url(for: bin.id).absoluteString) {
                            Image(uiImage: qr).interpolation(.none).resizable().scaledToFit().frame(width: 220, height: 220)
                                .accessibilityLabel("QR code for this bin")
                        }
                        Text(bin.code).font(.system(size: 44, weight: .heavy).monospacedDigit())
                        Text(bin.displayName).font(.title3.weight(.semibold)).multilineTextAlignment(.center)
                        if !bin.location.trimmed.isEmpty { Text(bin.location).foregroundStyle(.secondary) }
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.black)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(.separator)))

                    Text("Stick this on the bin. Point the iPhone Camera at it and tap the link to open this bin in Bin Finder.")
                        .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Printing on Avery 5163 (4 × 2 in, 10 per sheet)").font(.headline)
                        Stepper("Start at label \(startAt + 1) of 10", value: $startAt, in: 0...9)
                        Text("Skip labels you've already used on a partly used sheet. Label 1 is top left, 2 is top right.")
                            .font(.footnote).foregroundStyle(.secondary)
                        Button {
                            if let url = try? Labels.pdfFile(for: [bin], name: "Bin Label \(bin.code)", startAt: startAt) { share = ShareItem(url: url) }
                        } label: {
                            Label("Print or share label", systemImage: "printer").frame(maxWidth: .infinity).padding(.vertical, 6)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("QR label")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(item: $share) { ActivityView(items: [$0.url]) }
        }
    }
}
