import AppKit
import UniformTypeIdentifiers

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, NSTableViewDataSource, NSTableViewDelegate {
    var window: NSWindow!
    let bridge = SkinBridge()
    var library: SkinLibrary?
    let status = NSTextField(wrappingLabelWithString: "")
    let progress = NSProgressIndicator()
    let table = NSTableView()
    var rows: [[String: Any]] = []
    var activeId: String?
    var buttons: [NSButton] = []
    let preview = SkinPreview(frame: .zero)
    let footer = NSStackView()
    var footerHeight: NSLayoutConstraint?
    let emptyState = NSTextField(labelWithString: "暂无皮肤")
    var working = false
    var automaticSync: LibraryAutoSync?
    var lastSyncKey: String?
    var automaticSyncError: String?
    func label(_ value: String, size: CGFloat, color: NSColor = .labelColor, weight: NSFont.Weight = .regular) -> NSTextField {
        let field = NSTextField(wrappingLabelWithString: value); field.font = .systemFont(ofSize: size, weight: weight); field.textColor = color; return field
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu(), appMenu = NSMenu(), item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        appMenu.addItem(withTitle: "退出 Codex Skin", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"); NSApp.mainMenu = menu
        let fileMenu = NSMenu(title: "文件"), fileItem = NSMenuItem()
        fileItem.title = "文件"; fileItem.submenu = fileMenu; menu.addItem(fileItem)
        fileMenu.addItem(actionItem("新建皮肤", action: "new", key: "n"))
        fileMenu.addItem(actionItem("导入…", action: "import", key: "o"))
        fileMenu.addItem(actionItem("导出…", action: "export"))
        let skinMenu = NSMenu(title: "皮肤"), skinItem = NSMenuItem()
        skinItem.title = "皮肤"; skinItem.submenu = skinMenu; menu.addItem(skinItem)
        for (title, action) in [("应用", "apply"), ("重命名…", "rename"), ("复制", "duplicate"), ("删除…", "delete"), ("检查连接", "check"), ("恢复原生界面", "restore")] { skinMenu.addItem(actionItem(title, action: action)) }
        makeWindow()
        do { let args=CommandLine.arguments
            let testRoot:URL? = args.firstIndex(of:"--acceptance-library").flatMap {i in i+1<args.count ? URL(fileURLWithPath:args[i+1]) : nil}
            library = try SkinLibrary(root:testRoot); try refresh() } catch { setStatus(error.localizedDescription) }
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        if let index = CommandLine.arguments.firstIndex(of: "--smoke"), CommandLine.arguments.count > index + 1 {
            let action = CommandLine.arguments[index + 1]; buttons.forEach { $0.isEnabled = $0.identifier?.rawValue == action }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.execute(action) }
        } else if !CommandLine.arguments.contains("--acceptance-library") {
            automaticSync = LibraryAutoSync(shouldRun: { [weak self] in self?.working == false }, operation: { [weak self] in
                try await self?.synchronizeAutomatically()
            }, onError: { [weak self] error in
                self?.automaticSyncError = "自动保存失败：" + error.localizedDescription
                self?.setStatus(self?.automaticSyncError ?? "")
            })
            automaticSync?.start()
        }
    }
    func synchronizeAutomatically() async throws {
        guard let library = library else { return }
        // Disconnection is normal. Reconnect automatically without launching Codex.
        guard let url = try? await bridge.libraryTarget() else { lastSyncKey = nil; return }
        guard (try? await bridge.evaluate("!!window.__codexVideoSkinV1?.settingsPanel", at: url)) as? Bool == true else { lastSyncKey = nil; return }
        try await bridge.prepareLibrary(library, at: url)
        let snapshot = try await bridge.librarySnapshot(at: url)
        let revision = try library.read()["revision"] ?? 0
        let key = try bridge.json(["target":url.absoluteString, "snapshot":snapshot, "revision":revision])
        guard key != lastSyncKey else { return }
        _ = try await bridge.syncLibrary(library, at: url, snapshot: snapshot)
        // Keep the pre-sync key: edits made during transfer must be collected next time.
        lastSyncKey = key
        try refresh()
        if let message = automaticSyncError, status.stringValue == message { setStatus("") }
        automaticSyncError = nil
    }
    func button(_ title: String, id: String) -> NSButton {
        let b = NSButton(title: title, target: self, action: #selector(clicked(_:))); b.bezelStyle = .rounded; b.controlSize = .regular; b.identifier = NSUserInterfaceItemIdentifier(id); b.setAccessibilityIdentifier("skin-" + id); buttons.append(b); return b
    }
    @objc func clicked(_ sender: NSButton) { execute(sender.identifier?.rawValue ?? "") }
    func numberOfRows(in tableView: NSTableView) -> Int { rows.count }
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        skinCell(rows[row])
    }
    var selected: [String: Any]? { table.selectedRow >= 0 && table.selectedRow < rows.count ? rows[table.selectedRow] : nil }
    func refresh(select id: String? = nil) throws {
        guard let library = library else { return }
        let state = try library.read()
        activeId=state["activeId"] as? String
        let previous = id ?? selected?["draftId"] as? String ?? selected?["id"] as? String ?? activeId, skins = state["skins"] as? [[String: Any]] ?? [], drafts = state["drafts"] as? [[String: Any]] ?? []
        rows = []
        for skin in skins {
            rows.append(skin)
            for draft in drafts where draft["skinId"] as? String == skin["id"] as? String {
                var item = skin; item["draft"] = ["asset":draft["asset"] ?? NSNull(), "profiles":draft["profiles"] ?? [:]]; item["draftId"] = draft["id"]; item["revision"] = draft["baseRevision"]; rows.append(item)
            }
        }
        table.reloadData()
        if let row = rows.firstIndex(where: {($0["draftId"] as? String ?? $0["id"] as? String) == previous}) { table.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false) }
        else if !rows.isEmpty { table.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false) }
        updateControls()
        preview.show(selected, library: library)
    }
    func askName(_ title: String, value: String) -> String? {
        let alert = NSAlert(); alert.messageText = title; alert.addButton(withTitle: "保存"); alert.addButton(withTitle: "取消")
        let input = NSTextField(string: value); input.frame = NSRect(x: 0, y: 0, width: 300, height: 24); alert.accessoryView = input; alert.window.initialFirstResponder = input
        return alert.runModal() == .alertFirstButtonReturn ? input.stringValue : nil
    }
    func approveRestart() -> Bool {
        let alert = NSAlert(); alert.messageText = "需要重新启动 Codex"; alert.informativeText = "重启将中断正在执行的任务。"
        alert.addButton(withTitle: "取消"); alert.addButton(withTitle: "重启并应用"); return alert.runModal() == .alertSecondButtonReturn
    }
    func draftDecision() -> String? {
        let alert = NSAlert(); alert.messageText = "当前皮肤还有未保存的调整"
        for title in ["保存并切换", "保留草稿并切换", "放弃修改并切换", "取消"] { alert.addButton(withTitle: title) }
        return [1000:"save", 1001:"keep", 1002:"discard"][alert.runModal().rawValue]
    }
    func execute(_ action: String) {
        if let i = CommandLine.arguments.firstIndex(of: "--smoke"), CommandLine.arguments.count > i+1, action != CommandLine.arguments[i+1] { return }
        guard !working else { return }; working = true; buttons.forEach {$0.isEnabled=false}; table.isEnabled=false; progress.startAnimation(nil); setStatus("正在处理…")
        Task {
            await automaticSync?.finishPending()
            var success = false
            do {
                guard let library = library else { throw SkinError("个人库未就绪，请检查本机存储后重新打开 App") }
                switch action {
                case "preview":
                    try await verifyPreview()
                case "layout":
                    try verifyLibraryLayout()
                case "new":
                    if let title = askName("新建皮肤", value: "新的皮肤") { let id=UUID().uuidString; _ = try library.execute(["type":"create","id":id,"name":title,"content":["asset":NSNull(),"profiles":["dark":["textMode":"light"],"light":["textMode":"dark"]]]]);try refresh(select:id);setStatus("") }
                case "rename", "duplicate":
                    guard let skin=selected,let id=skin["id"] as? String else { throw SkinError("请先选择皮肤") }
                    if let title=askName(action=="rename" ? "重命名皮肤" : "复制皮肤",value:(skin["name"] as? String ?? "皮肤")+(action=="duplicate" ? " 副本" : "")) {
                        let target=action=="rename" ? id : UUID().uuidString
                        _ = try library.execute(["type":action,"id":target,"sourceId":id,"name":title]);try refresh(select:target);setStatus("")
                    }
                case "delete":
                    guard let skin=selected,let id=skin["id"] as? String else { throw SkinError("请先选择皮肤") }
                    if let draft=skin["draftId"] as? String {
                        let alert=NSAlert();alert.messageText="放弃这份草稿？";alert.addButton(withTitle:"取消");alert.addButton(withTitle:"放弃草稿")
                        if alert.runModal() == .alertSecondButtonReturn {
                            let url=try await bridge.libraryTarget();try await bridge.prepareLibrary(library,at:url)
                            _ = try await bridge.evaluate("window.__codexVideoSkinV1.settingsPanel.library.discardDraft(\(try bridge.json(draft)))",at:url)
                            _ = try library.execute(["type":"discard","id":draft]);_ = try await bridge.syncLibrary(library,at:url);try refresh();setStatus("")
                        }
                        break
                    }
                    let alert=NSAlert();alert.messageText="删除这套皮肤？";alert.addButton(withTitle:"取消");alert.addButton(withTitle:"删除")
                    if alert.runModal() == .alertSecondButtonReturn {_ = try library.execute(["type":"delete","id":id]);try refresh();setStatus("")}
                case "import":
                    let panel=NSOpenPanel();panel.allowedContentTypes=[.json];panel.allowsMultipleSelection=false
                    if panel.runModal() == .OK,let url=panel.url {let size=try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0;guard size<92*1024*1024 else{throw SkinError("皮肤包过大")};_ = try library.importPackage(Data(contentsOf:url));try refresh();setStatus("")}
                case "export":
                    guard let id=selected?["id"] as? String else {throw SkinError("请先选择皮肤")}
                    let panel=NSSavePanel();panel.allowedContentTypes=[.json];panel.nameFieldStringValue="skin-package.json"
                    if panel.runModal() == .OK,let url=panel.url {try library.exportPackage(id).write(to:url,options:.atomic);setStatus("已导出")}
                case "apply":
                    let choice=selected
                    if action=="apply" {try await bridge.launchReady {self.approveRestart()}}
                    let url=try await bridge.libraryTarget();try await bridge.prepareLibrary(library,at:url)
                    _ = try await bridge.syncLibrary(library,at:url)
                    if action=="apply",let original=choice {
                        try refresh()
                        guard let skin=rows.first(where: {row in
                            if let draft=original["draftId"] as? String {return row["draftId"] as? String==draft}
                            return row["draft"]==nil && row["id"] as? String==original["id"] as? String
                        }) else {throw SkinError("所选皮肤已变化，请重新选择") }
                        let info=try await bridge.evaluate("window.__codexVideoSkinV1.settingsPanel.library.status()",at:url) as? [String:Any]
                        var decision="keep"
                        if info?["dirty"] as? Bool == true {guard let answer=draftDecision() else {throw SkinError("已取消")};decision=answer}
                        try await bridge.applyLibrarySkin(skin,library:library,decision:decision,at:url)
                    }
                    try refresh();setStatus("")
                default: setStatus(try await bridge.perform(action))
                }
                success=true
            } catch {setStatus(error.localizedDescription)}
            if status.stringValue == "正在处理…" { setStatus("") }
            progress.stopAnimation(nil);table.isEnabled=true;working=false;updateControls();setStatus(status.stringValue)
            if CommandLine.arguments.contains("--smoke") {
                let report:[String:Any]=["success":success,"action":action,"message":status.stringValue,"buttonsEnabled":buttons.allSatisfy { $0.isEnabled == canExecute($0.identifier?.rawValue ?? "") },"windowVisible":window.isVisible]
                if let data=try? JSONSerialization.data(withJSONObject:report,options:[.sortedKeys]) {print(String(decoding:data,as:UTF8.self))};exit(success ? 0 : 1)
            }
        }
    }
    func windowDidMiniaturize(_ notification: Notification) { preview.suspend(true) }
    func windowDidDeminiaturize(_ notification: Notification) { preview.suspend(false) }
    func windowShouldClose(_ sender:NSWindow)->Bool {if working{NSSound.beep();return false};preview.stop();return true}
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool {true}
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply {working ? .terminateCancel : .terminateNow}
}
@main struct SkinApplication {
    @MainActor static func main() {let app=NSApplication.shared;let delegate=AppDelegate();app.delegate=delegate;withExtendedLifetime(delegate){app.run()}}
}
