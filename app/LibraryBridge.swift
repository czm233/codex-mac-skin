import Foundation

@MainActor extension SkinBridge {
    func json(_ value: Any) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]), as: UTF8.self)
    }
    func libraryTarget() async throws -> URL {
        var valid: [URL] = []
        for url in try await targets() {
            if try await evaluate("Boolean(document.getElementById('root')&&document.querySelector('main,[role=main]'))", at: url) as? Bool == true { valid.append(url) }
        }
        guard valid.count == 1, let url = valid.first else { throw SkinError("个人皮肤库当前需要一个 Codex 主窗口；请保留要换肤的窗口后重试。") }
        return url
    }
    func prepareLibrary(_ library: SkinLibrary, at url: URL) async throws {
        guard let versionFile=Bundle.main.url(forResource:"skin-build",withExtension:"txt") else {throw SkinError("缺少核心版本信息")}
        let revision=try String(contentsOf:versionFile,encoding:.utf8)
        if try await evaluate("!!window.__codexVideoSkinV1?.settingsPanel?.library && window.__codexVideoSkinV1.buildRevision===\(try json(revision))",at:url) as? Bool == true {return}
        // Only skin-owned state is read. Back up before replacing the injected core.
        let old = try await evaluate("(()=>{const a=window.__codexVideoSkinV1;return a?.settingsPanel?{config:JSON.parse(a.settingsPanel.exportConfig()),size:a.getMediaBlob()?.size||0,mime:a.getMediaBlob()?.type||''}:null})()", at: url) as? [String: Any]
        if var old = old {
            if let size = old["size"] as? Int, size > 0 {
                let data = try await readMedia(size: size, expression: "window.__codexVideoSkinV1.getMediaBlob()", at: url)
                old["asset"] = try library.putAsset(data: data, mime: old["mime"] as? String ?? "video/mp4", name: "迁移前背景")
            }
            try library.backupLegacy(old, name: "before-injection-" + UUID().uuidString)
        }
        guard let file = Bundle.main.url(forResource: "skin", withExtension: "js") else { throw SkinError("App 缺少换肤核心") }
        _ = try await evaluate(try String(contentsOf: file, encoding: .utf8), at: url)
        guard try await evaluate("!!window.__codexVideoSkinV1?.settingsPanel?.library", at: url) as? Bool == true else { throw SkinError("页面个人库未能恢复，已保留迁移前备份") }
    }
    private func readMedia(size: Int, expression: String, at url: URL) async throws -> Data {
        guard size > 0, size <= 64 * 1024 * 1024 else { throw SkinError("素材大小无效") }
        var data = Data()
        for offset in stride(from: 0, to: size, by: 196608) {
            let code = "(async()=>{const b=\(expression);const bytes=new Uint8Array(await b.slice(\(offset),\(offset+196608)).arrayBuffer());let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s)})()"
            guard let encoded = try await evaluate(code, at: url) as? String, let part = Data(base64Encoded: encoded) else { throw SkinError("背景传输失败") }
            data.append(part)
        }
        guard data.count == size else { throw SkinError("背景传输不完整") }; return data
    }
    func librarySnapshot(at url: URL) async throws -> [String: Any] {
        guard let snapshot = try await evaluate("window.__codexVideoSkinV1.settingsPanel.library.snapshot()", at: url) as? [String: Any] else { throw SkinError("页面草稿读取失败") }
        return snapshot
    }
    func syncLibrary(_ library: SkinLibrary, at url: URL, snapshot supplied: [String: Any]? = nil) async throws -> [String: Any] {
        let prefix = "window.__codexVideoSkinV1.settingsPanel.library"
        let snapshot: [String: Any]
        if let supplied = supplied { snapshot = supplied } else { snapshot = try await librarySnapshot(at: url) }
        guard let session = snapshot["sessionId"] as? String,
              let operations = snapshot["operations"] as? [[String: Any]], let drafts = snapshot["drafts"] as? [[String: Any]] else { throw SkinError("页面草稿读取失败") }
        let entries = operations + drafts + ((snapshot["current"] as? [String: Any]).map {[$0]} ?? [])
        let hashes = Set(entries.compactMap { ($0["content"] as? [String: Any])?["asset"] as? String })
        for hash in hashes where (try? library.asset(hash)) == nil {
            let encodedHash = try json(hash)
            guard let info = try await evaluate("\(prefix).assetInfo(\(encodedHash))", at: url) as? [String: Any], let size = info["size"] as? Int, size > 0, size <= 64 * 1024 * 1024 else { throw SkinError("页面背景信息无效") }
            var data = Data()
            for offset in stride(from: 0, to: size, by: 196608) {
                guard let chunk = try await evaluate("\(prefix).assetChunk(\(encodedHash),\(offset))", at: url) as? String, let bytes = Data(base64Encoded: chunk) else { throw SkinError("背景同步失败") }
                data.append(bytes)
            }
            guard data.count == size else { throw SkinError("背景同步不完整") }
            _ = try library.putAsset(data: data, mime: info["mime"] as? String ?? "", name: info["name"] as? String ?? "背景", expected: hash)
        }
        if let backup = try await evaluate("\(prefix).backup()", at: url) as? [String: Any] { try library.backupLegacy(backup, name: session) }
        let state = try library.execute(["type":"receive", "sessionId":session, "operations":operations, "drafts":drafts, "current":snapshot["current"] ?? NSNull()])
        _ = try await evaluate("\(prefix).acknowledge(\(try json(state["receipts"] ?? [])),\(try json(state["skins"] ?? [])))", at: url)
        return state
    }
    func applyLibrarySkin(_ skin: [String: Any], library: SkinLibrary, decision: String, at url: URL) async throws {
        let prefix = "window.__codexVideoSkinV1.settingsPanel.library"
        let draft = skin["draft"] as? [String: Any]
        let hashes = Set([skin["asset"] as? String, draft?["asset"] as? String].compactMap {$0})
        for hash in hashes {
            let asset = try library.asset(hash)
            guard let encoded = asset["base64"] as? String, let bytes = Data(base64Encoded: encoded) else { throw SkinError("素材读取失败") }
            let meta: [String: Any] = ["hash":hash, "mime":asset["mime"] ?? "", "name":asset["name"] ?? "背景", "size":bytes.count]
            _ = try await evaluate("\(prefix).begin(\(try json(meta)))", at: url)
            for offset in stride(from: 0, to: bytes.count, by: 196608) {
                let part = bytes.subdata(in: offset..<min(offset+196608, bytes.count)).base64EncodedString()
                _ = try await evaluate("\(prefix).append(\(try json(part)))", at: url)
            }
            _ = try await evaluate("\(prefix).finish()", at: url)
        }
        let previousActive = try library.read()["activeId"] as? String
        _ = try await evaluate("\(prefix).activate(\(try json(skin)),\(try json(decision)))", at: url)
        do {
            _ = try library.execute(["type":"activate", "id":skin["id"] ?? ""])
            _ = try await syncLibrary(library, at: url)
            _ = try await evaluate("\(prefix).finalize()", at: url)
        } catch {
            _ = try? await evaluate("\(prefix).rollback()", at: url)
            if let previousActive=previousActive {_ = try? library.execute(["type":"activate","id":previousActive])}
            throw error
        }
    }
}
