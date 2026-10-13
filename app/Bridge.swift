import AppKit

struct SkinError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

func runTool(_ executable: String, _ arguments: [String], allowFailure: Bool = false) throws -> String {
    let process = Process(), pipe = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    try process.run()
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    guard allowFailure || process.terminationStatus == 0 else { throw SkinError("本机检查失败：\(URL(fileURLWithPath: executable).lastPathComponent)") }
    return String(decoding: data, as: UTF8.self)
}

// No redirects, credentials, cookies, remote hosts or persistent network cache.
final class LocalSessionDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor
final class SkinBridge {
    static let port = 10270
    static let bundleID = "com.openai.codex"
    let session: URLSession
    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 5
        config.timeoutIntervalForResource = 25
        config.httpShouldSetCookies = false
        config.connectionProxyDictionary = [:]
        session = URLSession(configuration: config, delegate: LocalSessionDelegate(), delegateQueue: nil)
    }
    func codexURL() throws -> URL {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: Self.bundleID),
              Bundle(url: url)?.bundleIdentifier == Self.bundleID else {
            throw SkinError("没有找到 Codex。请先将官方 Codex 安装到应用程序文件夹。")
        }
        // Trust the installed official application, not an arbitrary process bearing its name.
        _ = try runTool("/usr/bin/codesign", ["--verify", "-R", "=anchor apple generic and identifier \"com.openai.codex\" and certificate leaf[subject.OU] = \"2DC432GLL2\"", url.path])
        return url
    }
    func listenerPIDs() throws -> Set<Int32> {
        let output = try runTool("/usr/sbin/lsof", ["-nP", "-iTCP:\(Self.port)", "-sTCP:LISTEN", "-t"], allowFailure: true)
        return Set(output.split(whereSeparator: \.isWhitespace).compactMap { Int32($0) })
    }
    func verifyOwner() throws {
        let url = try codexURL()
        let pids = try listenerPIDs()
        guard !pids.isEmpty else { throw SkinError("Codex 尚未开启换肤连接。请点击“连接 Codex”。") }
        let apps = NSRunningApplication.runningApplications(withBundleIdentifier: Self.bundleID).filter { $0.bundleURL?.standardizedFileURL == url.standardizedFileURL && pids.contains($0.processIdentifier) }
        guard apps.count == 1, let root = apps.first else { throw SkinError("端口 10270 被其他进程占用，未连接或终止任何程序。") }
        let rows = try runTool("/bin/ps", ["-axo", "pid=,ppid=,command="])
        var parents: [Int32: Int32] = [:]
        var commands: [Int32: String] = [:]
        for row in rows.split(separator: "\n") {
            let fields = row.split(maxSplits: 2, whereSeparator: \.isWhitespace)
            if fields.count == 3, let pid = Int32(fields[0]), let parent = Int32(fields[1]) { parents[pid] = parent; commands[pid] = String(fields[2]) }
        }
        guard commands[root.processIdentifier]?.contains("--remote-debugging-port=\(Self.port)") == true else { throw SkinError("Codex 调试参数不匹配。") }
        for pid in pids {
            var ancestor = pid
            for _ in 0..<40 {
                if ancestor == root.processIdentifier { break }
                ancestor = parents[ancestor] ?? -1
            }
            guard ancestor == root.processIdentifier else { throw SkinError("端口存在不属于 Codex 的监听进程，已停止连接。") }
        }
        let addresses = try runTool("/usr/sbin/lsof", ["-nP", "-iTCP:\(Self.port)", "-sTCP:LISTEN"])
        for line in addresses.split(separator: "\n").dropFirst() {
            guard line.contains("127.0.0.1:\(Self.port)") || line.contains("[::1]:\(Self.port)") else { throw SkinError("换肤连接必须只监听本机地址。") }
        }
    }
    func targets() async throws -> [URL] {
        try verifyOwner()
        let (data, response) = try await session.data(from: URL(string: "http://127.0.0.1:\(Self.port)/json/list")!)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 2_000_000,
              let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { throw SkinError("Codex 连接返回了无效窗口列表。") }
        let urls = rows.compactMap { row -> URL? in
            guard row["type"] as? String == "page", let raw = row["url"] as? String,
                  let page = URLComponents(string: raw), page.scheme == "app", page.host == "-", page.path == "/index.html",
                  !((page.queryItems ?? []).contains { $0.name == "initialRoute" && $0.value == "/avatar-overlay" }),
                  let endpoint = row["webSocketDebuggerUrl"] as? String, let socket = URL(string: endpoint),
                  socket.scheme == "ws", socket.host == "127.0.0.1", socket.port == Self.port,
                  socket.user == nil, socket.password == nil, socket.path.hasPrefix("/devtools/page/") else { return nil }
            return socket
        }
        guard !urls.isEmpty else { throw SkinError("Codex 主窗口还没有加载完成，请稍后重试。") }
        return urls
    }
    func evaluate(_ expression: String, at url: URL) async throws -> Any {
        let socket = session.webSocketTask(with: url)
        socket.maximumMessageSize = 2_000_000
        socket.resume()
        let timeout = Task { try await Task.sleep(nanoseconds: 25_000_000_000); socket.cancel(with: .goingAway, reason: nil) }
        defer { timeout.cancel(); socket.cancel(with: .normalClosure, reason: nil) }
        let payload: [String: Any] = ["id": 1, "method": "Runtime.evaluate", "params": ["expression": expression, "awaitPromise": true, "returnByValue": true, "timeout": 20000]]
        let encoded = try JSONSerialization.data(withJSONObject: payload)
        try await socket.send(.string(String(decoding: encoded, as: UTF8.self)))
        while true {
            let message = try await socket.receive()
            let data: Data
            switch message { case .data(let d): data = d; case .string(let s): data = Data(s.utf8); @unknown default: throw SkinError("未知连接响应。") }
            guard let result = try JSONSerialization.jsonObject(with: data) as? [String: Any], result["id"] as? Int == 1 else { continue }
            guard result["error"] == nil, let body = result["result"] as? [String: Any] else { throw SkinError("换肤连接执行失败，请重试") }
            if let details = body["exceptionDetails"] as? [String: Any] {
                let description = (details["exception"] as? [String: Any])?["description"] as? String ?? "换肤代码执行失败"
                throw SkinError(String((description.components(separatedBy:"\n").first ?? description).prefix(240)))
            }
            return (body["result"] as? [String: Any])?["value"] ?? NSNull()
        }
    }
    func perform(_ action: String) async throws -> String {
        let urls = try await targets()
        var count = 0, active = false
        for url in urls {
            let valid = try await evaluate("Boolean(document.getElementById('root') && document.querySelector('main,[role=main]'))", at: url)
            guard valid as? Bool == true else { continue }
            let expression: String
            switch action {
            case "apply":
                guard let file = Bundle.main.url(forResource: "skin", withExtension: "js") else { throw SkinError("App 缺少换肤核心，请重新安装。") }
                expression = try String(contentsOf: file, encoding: .utf8)
            case "settings": expression = "(()=>{const a=window.__codexVideoSkinV1;if(!a?.settingsPanel)return {missing:true};a.settingsPanel.show();return {active:a.status().active};})()"
            case "restore": expression = "(()=>{window.__codexVideoSkinV1?.destroy();return {restored:!document.getElementById('cvs-video')&&!document.documentElement.classList.contains('cvs-active')};})()"
            default: expression = "({active:!!window.__codexVideoSkinV1?.status().active})"
            }
            let result = try await evaluate(expression, at: url) as? [String: Any] ?? [:]
            if result["missing"] as? Bool == true { throw SkinError("尚未加载皮肤，请先连接 Codex 并应用皮肤。") }
            if action == "restore" && result["restored"] as? Bool != true { throw SkinError("恢复尚未完成，请重试。") }
            active = active || result["active"] as? Bool == true
            count += 1
        }
        guard count > 0 else { throw SkinError("没有找到受支持的 Codex 主窗口。") }
        switch action {
        case "apply": return active ? "已应用到 \(count) 个窗口。关闭本 App 后，背景仍会继续播放。" : "皮肤设置已加载。请在 Codex 右下角选择一个视频或图片。"
        case "settings": return "已打开皮肤设置"
        case "restore": return "已恢复原生界面"
        default: return active ? "Codex 已连接 · 皮肤正在运行" : "Codex 已连接 · 尚未应用背景"
        }
    }
    func launchReady(approveRestart: () -> Bool) async throws {
        if !(try listenerPIDs()).isEmpty { try verifyOwner(); return }
        let url = try codexURL()
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: Self.bundleID)
        if !running.isEmpty {
            guard approveRestart() else { throw SkinError("已取消重启，Codex 保持原样。") }
            for app in running { guard app.terminate() else { throw SkinError("Codex 未接受退出请求，请手动退出后再试。") } }
            for _ in 0..<60 {
                if running.allSatisfy(\.isTerminated) { break }
                try await Task.sleep(nanoseconds: 500_000_000)
            }
            guard running.allSatisfy(\.isTerminated) else { throw SkinError("Codex 尚未退出，未强制结束进程。请处理未完成的任务后再试。") }
        }
        guard (try listenerPIDs()).isEmpty else { throw SkinError("端口 10270 刚被占用，请重试。") }
        let config = NSWorkspace.OpenConfiguration()
        config.arguments = ["--remote-debugging-address=127.0.0.1", "--remote-debugging-port=\(Self.port)"]
        config.createsNewApplicationInstance = true
        _ = try await NSWorkspace.shared.openApplication(at: url, configuration: config)
        for _ in 0..<45 {
            if (try? await targets()) != nil { return }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        throw SkinError("Codex 在 45 秒内没有准备好换肤连接，请稍后重试。")
    }
}
