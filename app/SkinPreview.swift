import AppKit
import WebKit

@MainActor final class SkinPreview: NSView, WKNavigationDelegate {
    let scheme = NSSegmentedControl(labels: ["Dark", "Light"], trackingMode: .selectOne, target: nil, action: nil)
    let playback = NSButton(title: "", target: nil, action: nil)
    let message = NSTextField(wrappingLabelWithString: "选择皮肤以预览")
    let web: WKWebView
    private var ready = false
    private var renderTask: Task<Void, Never>?
    private var signature: Data?
    private var current: [String: Any]?
    private var root: URL?
    private var generation = UUID().uuidString
    private var paused = false
    private var suspended = false
    private var mediaCache: (hash: String, data: Data, mime: String)?
    private(set) var previewError: String?
    private(set) var renderedID: String?
    private(set) var renderedMode = "dark"

    override init(frame: NSRect) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: .zero, configuration: config)
        super.init(frame: frame)
        web.navigationDelegate = self
        web.setAccessibilityLabel("主题效果预览")
        web.setAccessibilityIdentifier("skin-preview")
        web.allowsBackForwardNavigationGestures = false
        let heading = NSTextField(labelWithString: "效果预览")
        heading.font = .systemFont(ofSize: 12, weight: .medium)
        heading.textColor = .secondaryLabelColor
        scheme.selectedSegment = 0
        scheme.target = self; scheme.action = #selector(changeScheme)
        scheme.setAccessibilityIdentifier("preview-scheme")
        playback.bezelStyle = .texturedRounded
        playback.isBordered = false
        playback.target = self; playback.action = #selector(togglePlayback)
        playback.setAccessibilityIdentifier("preview-playback")
        updatePlaybackButton()
        let header = NSStackView(views: [heading, NSView(), playback, scheme])
        header.orientation = .horizontal; header.spacing = 10
        message.textColor = .secondaryLabelColor; message.font = .systemFont(ofSize: 12)
        message.alignment = .center; message.setAccessibilityIdentifier("preview-message")
        for view in [header, web, message] { view.translatesAutoresizingMaskIntoConstraints = false; addSubview(view) }
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: topAnchor, constant: 22),
            header.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            header.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            header.heightAnchor.constraint(equalToConstant: 28),
            web.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            web.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            web.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            web.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -24),
            message.centerXAnchor.constraint(equalTo: web.centerXAnchor),
            message.centerYAnchor.constraint(equalTo: web.centerYAnchor),
            message.leadingAnchor.constraint(greaterThanOrEqualTo: web.leadingAnchor, constant: 24),
            message.trailingAnchor.constraint(lessThanOrEqualTo: web.trailingAnchor, constant: -24)
        ])
        web.wantsLayer = true; web.layer?.cornerRadius = 12; web.layer?.masksToBounds = true
        web.isHidden = true; scheme.isEnabled = false; playback.isHidden = true
        if let url = Bundle.main.url(forResource: "preview", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else { message.stringValue = "缺少预览资源" }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { ready = true }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let expected = Bundle.main.url(forResource: "preview", withExtension: "html")
        decisionHandler(navigationAction.request.url == expected ? .allow : .cancel)
    }
    func show(_ skin: [String: Any]?, library: SkinLibrary?) {
        let next = skin.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys]) }
        guard next != signature || root != library?.root else { return }
        signature = next; current = skin; root = library?.root
        startRender()
    }
    @objc func changeScheme() { startRender() }
    private func updatePlaybackButton() {
        let title = paused ? "播放预览" : "暂停预览"
        playback.image = NSImage(systemSymbolName: paused ? "play.fill" : "pause.fill", accessibilityDescription: title)
        playback.setAccessibilityLabel(title)
    }
    @objc func togglePlayback() {
        paused.toggle(); updatePlaybackButton()
        Task { _ = try? await call(paused ? "return window.skinPreview.pause()" : "return window.skinPreview.resume()") }
    }
    @discardableResult func call(_ script: String, arguments: [String: Any] = [:]) async throws -> Any {
        try await web.callAsyncJavaScript(script, arguments: arguments, in: nil, contentWorld: .page) ?? NSNull()
    }
    private func startRender() {
        renderTask?.cancel(); generation = UUID().uuidString
        let token = generation
        previewError = nil; renderedID = nil
        web.isHidden = true; playback.isHidden = true
        message.isHidden = false
        scheme.isEnabled = current != nil
        guard let skin = current, let root = root else {
            message.stringValue = "选择皮肤以预览"
            renderTask = Task { if ready { _ = try? await call("return window.skinPreview.clear()") } }
            mediaCache = nil; return
        }
        message.stringValue = "载入预览…"
        let content = skin["draft"] as? [String: Any] ?? skin
        let mode = scheme.selectedSegment == 1 ? "light" : "dark"
        let profile = (content["profiles"] as? [String: Any])?[mode] as? [String: Any] ?? [:]
        paused = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        updatePlaybackButton()
        renderTask = Task {
            do {
                var isVideo = false
                for _ in 0..<100 where !ready { try await Task.sleep(nanoseconds: 50_000_000) }
                try Task.checkCancellation()
                guard ready else { throw SkinError("预览未能载入") }
                _ = try await call("return window.skinPreview.begin(profile, mode, token)", arguments: ["profile":profile, "mode":mode, "token":token])
                if let hash = content["asset"] as? String {
                    let media: (Data, String)
                    if let cache = mediaCache, cache.hash == hash { media = (cache.data, cache.mime) }
                    else {
                        media = try await Task.detached {
                            let asset = try SkinLibrary.readAsset(hash, root: root)
                            guard let encoded = asset["base64"] as? String, let bytes = Data(base64Encoded: encoded), let mime = asset["mime"] as? String else { throw SkinError("素材读取失败") }
                            return (bytes, mime)
                        }.value
                    }
                    try Task.checkCancellation()
                    mediaCache = (hash, media.0, media.1)
                    _ = try await call("return window.skinPreview.media(size, mime, token)", arguments: ["size":media.0.count, "mime":media.1, "token":token])
                    for offset in stride(from: 0, to: media.0.count, by: 196608) {
                        try Task.checkCancellation()
                        let chunk = media.0.subdata(in: offset..<min(offset + 196608, media.0.count)).base64EncodedString()
                        _ = try await call("return window.skinPreview.append(chunk, token)", arguments: ["chunk":chunk,"token":token])
                    }
                    _ = try await call("return await window.skinPreview.finish(token)", arguments: ["token":token])
                    isVideo = media.1.hasPrefix("video/")
                } else { mediaCache = nil }
                try Task.checkCancellation()
                guard generation == token else { return }
                if paused || suspended { _ = try await call("return window.skinPreview.pause()") }
                playback.isHidden = !isVideo
                renderedID = skin["draftId"] as? String ?? skin["id"] as? String
                renderedMode = mode
                web.isHidden = false; message.isHidden = true
            } catch {
                guard generation == token, !Task.isCancelled else { return }
                previewError = error.localizedDescription
                message.stringValue = "无法预览：" + error.localizedDescription
                playback.isHidden = true
                _ = try? await call("return window.skinPreview.clear()")
            }
        }
    }
    func waitForRender() async { await renderTask?.value }
    func suspend(_ value: Bool) {
        suspended = value
        Task { _ = try? await call(value || paused ? "return window.skinPreview.pause()" : "return window.skinPreview.resume()") }
    }
    func stop() {
        renderTask?.cancel(); generation = UUID().uuidString; mediaCache = nil
        Task { _ = try? await call("return window.skinPreview.clear()") }
    }
}
