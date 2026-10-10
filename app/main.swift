import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    let bridge = SkinBridge()
    let status = NSTextField(wrappingLabelWithString: "准备就绪。点击下方按钮，将皮肤加载到 Codex。")
    let progress = NSProgressIndicator()
    var buttons: [NSButton] = []
    var working = false

    func label(_ value: String, size: CGFloat, color: NSColor = .labelColor, weight: NSFont.Weight = .regular) -> NSTextField {
        let field = NSTextField(wrappingLabelWithString: value)
        field.font = NSFont.systemFont(ofSize: size, weight: weight)
        field.textColor = color
        return field
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu(), appMenu = NSMenu()
        let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        appMenu.addItem(withTitle: "退出 Codex Skin", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 500, height: 454), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Codex Skin"
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(srgbRed: 0.075, green: 0.11, blue: 0.15, alpha: 1)
        let stack = NSStackView(); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        window.contentView!.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 30),
            stack.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -30),
            stack.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 28)
        ])
        stack.addArrangedSubview(label("LOCAL SKIN   /   macOS", size: 11, color: NSColor(srgbRed: 0.64, green: 0.85, blue: 0.87, alpha: 1), weight: .medium))
        stack.addArrangedSubview(label("让背景动起来。", size: 30, weight: .semibold))
        stack.addArrangedSubview(label("为 Codex 加载视频与图片背景。透明度、文字和配色，继续在 Codex 右下角调整。", size: 13, color: .secondaryLabelColor))
        let separator = NSBox(); separator.boxType = .separator; stack.addArrangedSubview(separator)
        separator.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        let row = NSStackView(); row.orientation = .horizontal; row.spacing = 10
        progress.style = .spinning; progress.controlSize = .small; progress.isDisplayedWhenStopped = false
        row.addArrangedSubview(progress)
        status.font = .systemFont(ofSize: 13); status.setAccessibilityIdentifier("skin-status")
        row.addArrangedSubview(status); stack.addArrangedSubview(row)
        row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        row.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        let apply = button("启动并应用皮肤", action: #selector(applySkin), id: "apply")
        apply.keyEquivalent = "\r"; apply.bezelColor = NSColor(srgbRed: 0.28, green: 0.56, blue: 0.60, alpha: 1)
        stack.addArrangedSubview(apply); apply.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        let actions = NSStackView(); actions.orientation = .horizontal; actions.distribution = .fillEqually; actions.spacing = 10
        actions.addArrangedSubview(button("打开皮肤设置", action: #selector(openSettings), id: "settings"))
        actions.addArrangedSubview(button("恢复原生界面", action: #selector(restore), id: "restore"))
        stack.addArrangedSubview(actions); actions.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.addArrangedSubview(button("检查连接", action: #selector(check), id: "check"))
        stack.addArrangedSubview(label("背景与参数保存在本机。应用后可以退出此 App。\n重新启动 Codex 后，请再次通过此 App 应用皮肤。", size: 11, color: .secondaryLabelColor))
        stack.addArrangedSubview(label("独立开发的第三方工具，与 OpenAI 无隶属关系。", size: 10, color: .tertiaryLabelColor))
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        if let index = CommandLine.arguments.firstIndex(of: "--smoke"), CommandLine.arguments.count > index + 1 {
            let action = CommandLine.arguments[index + 1]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                guard let button = self.buttons.first(where: { $0.identifier?.rawValue == action }) else { exit(2) }
                button.performClick(nil)
            }
        }
    }
    func button(_ title: String, action: Selector, id: String) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.bezelStyle = .rounded; b.controlSize = .large; b.identifier = NSUserInterfaceItemIdentifier(id)
        b.setAccessibilityIdentifier("skin-" + id); buttons.append(b); return b
    }
    func approveRestart() -> Bool {
        let alert = NSAlert(); alert.messageText = "需要重新启动 Codex"
        alert.informativeText = "当前 Codex 未开启本机换肤连接。重启会中断正在执行的任务，请先确认工作已保存。只会正常请求退出，不会强制结束进程。"
        alert.addButton(withTitle: "取消"); alert.addButton(withTitle: "重启并应用")
        return alert.runModal() == .alertSecondButtonReturn
    }
    func execute(_ action: String) {
        guard !working else { return }; working = true
        buttons.forEach { $0.isEnabled = false }; progress.startAnimation(nil)
        status.stringValue = "正在\(action == "apply" ? "准备并加载皮肤" : "连接 Codex")…"
        Task {
            var success = false
            do {
                if action == "apply" { try await bridge.launchReady { self.approveRestart() } }
                status.stringValue = try await bridge.perform(action)
                success = true
            } catch { status.stringValue = error.localizedDescription }
            progress.stopAnimation(nil); buttons.forEach { $0.isEnabled = true }; working = false
            if CommandLine.arguments.contains("--smoke") {
                let report: [String: Any] = ["success": success, "action": action, "message": status.stringValue, "buttonsEnabled": buttons.allSatisfy(\.isEnabled), "windowVisible": window.isVisible]
                if let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]), let json = String(data: data, encoding: .utf8) { print(json) }
                exit(success ? 0 : 1)
            }
        }
    }
    @objc func applySkin() { execute("apply") }
    @objc func openSettings() { execute("settings") }
    @objc func restore() { execute("restore") }
    @objc func check() { execute("check") }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if working { NSSound.beep(); return false }; return true
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if working { NSSound.beep(); return .terminateCancel }; return .terminateNow
    }
}
@main
struct SkinApplication {
    @MainActor static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
