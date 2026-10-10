import AppKit

@MainActor extension AppDelegate: NSToolbarDelegate, NSMenuItemValidation {
    func makeWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 980, height: 600), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.minSize = NSSize(width: 780, height: 440)
        window.title = "我的皮肤"
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.toolbarStyle = .unified
        let toolbar = NSToolbar(identifier: "skin-library-toolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("name"))
        column.width = 600
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.headerView = nil
        table.style = .inset
        table.rowHeight = 64
        table.intercellSpacing = NSSize(width: 0, height: 4)
        table.usesAlternatingRowBackgroundColors = false
        table.backgroundColor = .controlBackgroundColor
        table.columnAutoresizingStyle = .lastColumnOnlyAutoresizingStyle
        table.dataSource = self
        table.delegate = self
        table.setAccessibilityIdentifier("skin-library-list")
        table.setAccessibilityLabel("我的皮肤")
        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.borderType = .noBorder
        scroll.drawsBackground = true
        scroll.backgroundColor = .controlBackgroundColor
        scroll.contentInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        scroll.translatesAutoresizingMaskIntoConstraints = false
        let content = window.contentView!
        content.addSubview(scroll)
        preview.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(preview)
        let divider = NSBox(); divider.boxType = .separator; divider.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(divider)

        emptyState.font = .systemFont(ofSize: 14, weight: .medium)
        emptyState.textColor = .secondaryLabelColor
        emptyState.translatesAutoresizingMaskIntoConstraints = false
        emptyState.setAccessibilityIdentifier("skin-empty")
        content.addSubview(emptyState)

        footer.orientation = .horizontal
        footer.alignment = .centerY
        footer.spacing = 8
        footer.edgeInsets = NSEdgeInsets(top: 8, left: 20, bottom: 8, right: 20)
        footer.translatesAutoresizingMaskIntoConstraints = false
        progress.style = .spinning
        progress.controlSize = .small
        progress.isDisplayedWhenStopped = false
        status.font = .systemFont(ofSize: 11)
        status.textColor = .secondaryLabelColor
        status.setAccessibilityIdentifier("skin-status")
        footer.addArrangedSubview(progress)
        footer.addArrangedSubview(status)
        content.addSubview(footer)
        footerHeight = footer.heightAnchor.constraint(equalToConstant: 0)
        footerHeight?.isActive = true
        footer.isHidden = true
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: content.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            scroll.widthAnchor.constraint(equalToConstant: 240),
            divider.leadingAnchor.constraint(equalTo: scroll.trailingAnchor),
            divider.widthAnchor.constraint(equalToConstant: 1),
            divider.topAnchor.constraint(equalTo: scroll.topAnchor),
            divider.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
            preview.leadingAnchor.constraint(equalTo: divider.trailingAnchor),
            preview.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            preview.topAnchor.constraint(equalTo: content.topAnchor),
            preview.bottomAnchor.constraint(equalTo: footer.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: footer.topAnchor),
            footer.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            footer.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            footer.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            emptyState.centerXAnchor.constraint(equalTo: scroll.centerXAnchor),
            emptyState.centerYAnchor.constraint(equalTo: scroll.centerYAnchor)
        ])
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [NSToolbarItem.Identifier("new"), NSToolbarItem.Identifier("import"), .flexibleSpace, NSToolbarItem.Identifier("more"), NSToolbarItem.Identifier("apply")]
    }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier identifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        let item = NSToolbarItem(itemIdentifier: identifier)
        item.autovalidates = false
        if identifier.rawValue == "more" {
            let more = NSPopUpButton(frame: .zero, pullsDown: true)
            more.bezelStyle = .texturedRounded
            (more.cell as? NSPopUpButtonCell)?.arrowPosition = .noArrow
            more.addItem(withTitle: "")
            more.item(at: 0)?.image = NSImage(systemSymbolName: "ellipsis.circle", accessibilityDescription: "更多操作")
            more.menu?.addItem(.separator())
            for (title, action) in [("重命名…", "rename"), ("复制", "duplicate"), ("导出…", "export"), ("删除…", "delete")] {
                more.menu?.addItem(actionItem(title, action: action))
            }
            more.menu?.addItem(.separator())
            more.menu?.addItem(actionItem("检查连接", action: "check"))
            more.menu?.addItem(actionItem("恢复原生界面", action: "restore"))
            more.setAccessibilityLabel("更多操作")
            more.setAccessibilityIdentifier("skin-more")
            more.identifier = NSUserInterfaceItemIdentifier("more")
            buttons.append(more)
            item.label = "更多"
            item.view = more
        } else {
            let spec: (String, String)
            switch identifier.rawValue {
            case "new": spec = ("新建", "plus")
            case "import": spec = ("导入", "square.and.arrow.down")
            case "apply": spec = ("应用", "checkmark")
            default: return nil
            }
            let b = button(spec.0, id: identifier.rawValue)
            b.image = NSImage(systemSymbolName: spec.1, accessibilityDescription: nil)
            b.imagePosition = .imageLeading
            b.bezelStyle = .texturedRounded
            b.setAccessibilityLabel(spec.0)
            item.label = spec.0
            item.view = b
        }
        return item
    }
    func actionItem(_ title: String, action: String, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(menuAction(_:)), keyEquivalent: key)
        item.target = self
        item.representedObject = action
        return item
    }
    @objc func menuAction(_ item: NSMenuItem) { if let action = item.representedObject as? String { execute(action) } }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool { canExecute(menuItem.representedObject as? String ?? "") }
    func canExecute(_ action: String) -> Bool {
        guard !working else { return false }
        switch action {
        case "apply": return selected != nil
        case "rename", "duplicate", "export": return selected != nil && selected?["draftId"] == nil
        case "delete":
            guard let skin = selected else { return false }
            if skin["draftId"] != nil { return true }
            let id = skin["id"] as? String
            return id != activeId && !rows.contains { $0["draftId"] != nil && $0["id"] as? String == id }
        default: return true
        }
    }
    func updateControls() {
        for button in buttons { button.isEnabled = canExecute(button.identifier?.rawValue ?? "") }
        emptyState.isHidden = !rows.isEmpty
    }
    func tableViewSelectionDidChange(_ notification: Notification) { updateControls(); preview.show(selected, library: library) }
    func setStatus(_ message: String) {
        status.stringValue = message
        let hidden = message.isEmpty && !working
        footer.isHidden = hidden
        footerHeight?.constant = hidden ? 0 : 44
    }
    func skinCell(_ skin: [String: Any]) -> NSView {
        let draft = skin["draftId"] != nil
        let active = !draft && skin["id"] as? String == activeId
        let asset = draft ? (skin["draft"] as? [String: Any])?["asset"] : skin["asset"]
        let cell = NSTableCellView()
        let symbol = NSImageView(image: NSImage(systemSymbolName: draft ? "pencil.circle" : asset is String ? "photo.on.rectangle" : "circle.lefthalf.filled", accessibilityDescription: nil)!)
        symbol.contentTintColor = .secondaryLabelColor
        symbol.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 19, weight: .regular)
        let name = label(skin["name"] as? String ?? "皮肤", size: 13, weight: .medium)
        name.maximumNumberOfLines = 1; name.lineBreakMode = .byTruncatingTail
        name.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let type = label(draft ? "草稿" : asset is String ? "自定义背景" : "纯色", size: 11, color: .secondaryLabelColor)
        let text = NSStackView(views: [name, type]); text.orientation = .vertical; text.alignment = .leading; text.spacing = 4
        let current = label(active ? "使用中" : "", size: 11, color: .secondaryLabelColor)
        current.setContentCompressionResistancePriority(.required, for: .horizontal)
        for view in [symbol, text, current] { view.translatesAutoresizingMaskIntoConstraints = false; cell.addSubview(view) }
        NSLayoutConstraint.activate([
            symbol.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: draft ? 24 : 10),
            symbol.widthAnchor.constraint(equalToConstant: 24), symbol.heightAnchor.constraint(equalToConstant: 24),
            symbol.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            text.leadingAnchor.constraint(equalTo: symbol.trailingAnchor, constant: 8),
            text.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            text.trailingAnchor.constraint(lessThanOrEqualTo: current.leadingAnchor, constant: -12),
            current.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -14),
            current.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])
        cell.textField = name
        return cell
    }
    // Read-only native layout acceptance against an isolated library.
    func verifyLibraryLayout() throws {
        guard CommandLine.arguments.contains("--acceptance-library") else { throw SkinError("布局验收须使用隔离库") }
        working = false
        defer { working = true; window.appearance = nil }
        for appearance in [NSAppearance.Name.aqua, .darkAqua] {
            window.appearance = NSAppearance(named: appearance)
            for width: CGFloat in [780, 980, 1200] {
                window.setContentSize(NSSize(width: width, height: 440))
                window.contentView?.layoutSubtreeIfNeeded()
                table.layoutSubtreeIfNeeded()
                guard !table.usesAlternatingRowBackgroundColors,
                      !buttons.contains(where: { ["sync", "settings"].contains($0.identifier?.rawValue ?? "") }),
                      window.toolbar != nil else { throw SkinError("窗口结构不符合原生列表约定") }
                for row in 0..<rows.count {
                    guard let cell = table.view(atColumn: 0, row: row, makeIfNecessary: true) else { throw SkinError("列表行无法显示") }
                    cell.layoutSubtreeIfNeeded()
                    for child in cell.subviews {
                        guard child.frame.minX >= -1, child.frame.maxX <= cell.bounds.width + 1 else { throw SkinError("列表内容超出窗口") }
                    }
                }
            }
        }
        if let draft = rows.firstIndex(where: { $0["draftId"] != nil }) {
            table.selectRowIndexes(IndexSet(integer: draft), byExtendingSelection: false)
            let id = selected?["draftId"] as? String
            try refresh()
            guard selected?["draftId"] as? String == id, !canExecute("rename"), !canExecute("export"), canExecute("apply") else { throw SkinError("草稿选择或菜单状态错误") }
        }
        if let current = rows.firstIndex(where: { $0["draftId"] == nil && $0["id"] as? String == activeId }) {
            table.selectRowIndexes(IndexSet(integer: current), byExtendingSelection: false)
            guard !canExecute("delete") else { throw SkinError("当前皮肤不应可删除") }
        }
        if rows.isEmpty {
            guard !emptyState.isHidden, !canExecute("apply"), !canExecute("delete"), !canExecute("export") else { throw SkinError("空库操作状态错误") }
        }
        setStatus("")
        guard footer.isHidden else { throw SkinError("空状态栏未隐藏") }
    }

    func verifyPreview() async throws {
        guard CommandLine.arguments.contains("--acceptance-library"), let library = library else { throw SkinError("预览验收须使用隔离库") }
        let before = try JSONSerialization.data(withJSONObject: library.read(), options: [.sortedKeys])
        working = false
        defer { working = true; preview.stop() }
        if rows.isEmpty {
            preview.show(nil, library: library)
            await preview.waitForRender()
            guard preview.web.isHidden, !preview.scheme.isEnabled else { throw SkinError("空库预览状态错误") }
        }
        for index in rows.indices {
            table.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
            let skin = rows[index], content = skin["draft"] as? [String: Any] ?? skin
            for mode in 0...1 {
                preview.scheme.selectedSegment = mode; preview.changeScheme()
                await preview.waitForRender()
                let asset = content["asset"] as? String
                if let asset = asset, (try? library.asset(asset)) == nil {
                    guard preview.previewError != nil, preview.web.isHidden, preview.renderedID == nil else { throw SkinError("损坏素材显示了旧预览") }
                    continue
                }
                guard preview.previewError == nil, !preview.web.isHidden,
                      preview.renderedID == (skin["draftId"] as? String ?? skin["id"] as? String),
                      preview.renderedMode == (mode == 0 ? "dark" : "light") else { throw SkinError(preview.previewError ?? "预览选择错误") }
                guard let actual = try await preview.call("return window.skinPreview.status()") as? [String: Any],
                      let profiles = content["profiles"] as? [String: Any], let expected = profiles[mode == 0 ? "dark" : "light"] as? [String: Any],
                      (actual["dim"] as? Double) == (expected["dim"] as? Double) else { throw SkinError("预览参数错误") }
                if let colors = expected["colors"] as? [String: Any], let accent = colors["accent"] as? String {
                    let palette = try await preview.call("return window.skinPreview.getPalette()") as? [String: Any]
                    guard palette?["accent"] as? String == accent else { throw SkinError("预览配色未跟随方案") }
                }
                let sceneOK = try await preview.call("""
                    const demo=document.getElementById('demo'),chat=demo?.querySelector('.chat-scroll'),composer=demo?.querySelector('.composer');
                    if(!chat||!composer||!demo.querySelector('.rich-message')||document.getElementById('skin-toggle'))return false;
                    const a=chat.getBoundingClientRect(),b=composer.getBoundingClientRect();
                    return a.height>0&&a.bottom<=b.top+1&&b.bottom<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1;
                    """) as? Bool
                guard sceneOK == true else { throw SkinError("共用演示布局溢出或控件错误") }
                let kind = actual["mediaKind"] as? String
                if let asset = asset {
                    let mime = try library.asset(asset)["mime"] as? String ?? ""
                    guard kind == (mime.hasPrefix("image/") ? "image" : "video"), (actual["width"] as? Int ?? 0) > 0 else { throw SkinError("预览素材解码失败") }
                    if kind == "video" {
                        _ = try await preview.call("return window.skinPreview.resume()")
                        let first = try await preview.call("return window.skinPreview.status()") as? [String: Any] ?? [:]
                        try await Task.sleep(nanoseconds: 250_000_000)
                        let second = try await preview.call("return window.skinPreview.status()") as? [String: Any] ?? [:]
                        if second["hidden"] as? Bool == true || second["reducedMotion"] as? Bool == true {
                            guard second["paused"] as? Bool == true else { throw SkinError("不可见预览未暂停") }
                        } else {
                            guard abs((second["currentTime"] as? Double ?? 0) - (first["currentTime"] as? Double ?? 0)) > 0.01 else { throw SkinError("预览视频未播放：paused=\(second["paused"] ?? "unknown"), hidden=\(second["hidden"] ?? "unknown"), error=\(second["error"] ?? "none")") }
                        }
                        _ = try await preview.call("return window.skinPreview.pause()")
                        guard let stopped = try await preview.call("return window.skinPreview.status()") as? [String: Any], stopped["paused"] as? Bool == true else { throw SkinError("预览视频未暂停") }
                    }
                } else { guard kind == "none" else { throw SkinError("纯色皮肤残留媒体") } }
            }
        }
        // Rapid selection cancels stale decoding and must end on the final row.
        if let final = rows.first {
            for skin in rows.reversed() { preview.show(skin, library: library) }
            preview.show(final, library: library); await preview.waitForRender()
            guard preview.renderedID == (final["draftId"] as? String ?? final["id"] as? String) else { throw SkinError("快速选择显示了过期预览") }
        }
        if !rows.isEmpty {
            let interactionOK = try await preview.call("""
                document.getElementById('reference-link').click();
                const dialog=document.getElementById('reference-dialog'),opened=dialog.open;
                document.getElementById('reference-close').click();
                const chat=document.querySelector('.chat-scroll'),before=chat.scrollTop;
                chat.scrollTop=chat.scrollHeight;
                return opened&&!dialog.open&&chat.scrollTop>before;
                """) as? Bool
            guard interactionOK == true else { throw SkinError("共用演示滚动或资料弹窗失败") }
        }
        let after = try JSONSerialization.data(withJSONObject: library.read(), options: [.sortedKeys])
        guard before == after else { throw SkinError("预览修改了皮肤库") }
    }

}
