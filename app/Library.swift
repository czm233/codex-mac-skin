import Foundation
import JavaScriptCore
import CryptoKit
import Darwin

// The native and injected clients validate the same serialized JavaScript model.
// Files stay outside Codex's browser storage so host upgrades cannot erase the library.
final class SkinLibrary {
    let root: URL
    private let context: JSContext
    private let manager = FileManager.default
    init(root: URL? = nil, modelURL: URL? = nil) throws {
        self.root = root ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Codex Skin/Library", isDirectory: true)
        guard let context = JSContext(), let url = modelURL ?? Bundle.main.url(forResource: "library", withExtension: "js") else { throw SkinError("缺少皮肤库核心") }
        self.context = context
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
        if context.exception != nil { throw SkinError("皮肤库核心加载失败") }
        try manager.createDirectory(at: self.root.appendingPathComponent("assets"), withIntermediateDirectories: true)
        try manager.createDirectory(at: self.root.appendingPathComponent("backups"), withIntermediateDirectories: true)
    }
    private func invoke(_ method: String, _ arguments: [Any]) throws -> [String: Any] {
        context.exception = nil
        let result = context.objectForKeyedSubscript("skinLibraryModel")?.invokeMethod(method, withArguments: arguments)
        if let error = context.exception { throw SkinError(error.toString() ?? "皮肤数据无效") }
        guard let value = result?.toDictionary() as? [String: Any] else { throw SkinError("皮肤数据无效") }
        return value
    }
    private func locked<T>(_ operation: () throws -> T) throws -> T {
        let fd = open(root.appendingPathComponent("library.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw SkinError("无法锁定皮肤库") }
        defer { close(fd) }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else { throw SkinError("另一操作正在保存皮肤，请稍后重试") }
        defer { flock(fd, LOCK_UN) }
        return try operation()
    }
    private func readUnlocked() throws -> [String: Any] {
        let file = root.appendingPathComponent("library.json")
        guard manager.fileExists(atPath: file.path) else { return try invoke("empty", []) }
        let data = try Data(contentsOf: file)
        guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw SkinError("皮肤库损坏，原文件已保留") }
        return try invoke("validate", [value])
    }
    func read() throws -> [String: Any] { try locked { try readUnlocked() } }
    @discardableResult func execute(_ action: [String: Any]) throws -> [String: Any] {
        try locked {
            let previous = try readUnlocked()
            let next = try invoke("edit", [previous, action])
            let unchanged = try JSONSerialization.data(withJSONObject: previous, options: [.sortedKeys])
            var comparable = next; comparable["revision"] = previous["revision"]
            if try JSONSerialization.data(withJSONObject: comparable, options: [.sortedKeys]) == unchanged { return previous }
            let entries=(next["skins"] as? [[String: Any]] ?? []) + (next["drafts"] as? [[String: Any]] ?? [])
            for hash in Set(entries.compactMap {$0["asset"] as? String}) { _ = try asset(hash) }
            let file = root.appendingPathComponent("library.json")
            if manager.fileExists(atPath: file.path) {
                let backup = root.appendingPathComponent("backups/\(previous["revision"] ?? 0)-\(UUID().uuidString).json")
                try manager.copyItem(at: file, to: backup)
            }
            let data = try JSONSerialization.data(withJSONObject: next, options: [.sortedKeys])
            try data.write(to: file, options: .atomic)
            return next
        }
    }
    func backupLegacy(_ value: [String: Any], name: String) throws {
        guard !name.isEmpty, name.count < 120, name.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }) else { throw SkinError("备份名称无效") }
        let file = root.appendingPathComponent("backups/legacy-\(name).json")
        if !manager.fileExists(atPath: file.path) { try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: file, options: .atomic) }
    }
    private func assetURL(_ hash: String) throws -> URL {
        guard hash.count == 64, hash.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw SkinError("素材标识无效") }
        return root.appendingPathComponent("assets/\(hash).json")
    }
    @discardableResult func putAsset(data: Data, mime: String, name: String, expected: String? = nil) throws -> String {
        guard !data.isEmpty, data.count <= 64 * 1024 * 1024,
              ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "video/quicktime"].contains(mime) else { throw SkinError("背景须为支持的图片或视频，且不超过 64 MiB") }
        let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        if let expected = expected, expected != hash { throw SkinError("素材完整性校验失败") }
        let url = try assetURL(hash)
        // Reuse only verified bytes, never trust existence alone after interruption.
        if (try? asset(hash)) != nil { return hash }
        let record: [String: Any] = ["hash": hash, "mime": mime, "name": String(name.prefix(255)), "base64": data.base64EncodedString()]
        try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]).write(to: url, options: .atomic)
        return hash
    }
    func asset(_ hash: String) throws -> [String: Any] { try Self.readAsset(hash, root: root) }
    static func readAsset(_ hash: String, root: URL) throws -> [String: Any] {
        guard hash.count == 64, hash.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw SkinError("素材标识无效") }
        let url = root.appendingPathComponent("assets/\(hash).json")
        guard let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size < 92 * 1024 * 1024 else { throw SkinError("素材文件过大") }
        guard let record = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any],
              let encoded = record["base64"] as? String, let data = Data(base64Encoded: encoded), !data.isEmpty, data.count <= 64 * 1024 * 1024,
              SHA256.hash(data: data).map({String(format: "%02x", $0)}).joined() == hash,
              let mime = record["mime"] as? String,
              ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "video/quicktime"].contains(mime) else { throw SkinError("素材缺失或已损坏") }
        return record
    }
    func legacyProfiles(_ value: [String: Any]) throws -> [String: Any] { try invoke("importLegacy", [value]) }
    func exportPackage(_ id: String) throws -> Data {
        let state = try read()
        guard let skin = (state["skins"] as? [[String: Any]])?.first(where: {$0["id"] as? String == id}) else { throw SkinError("请选择皮肤") }
        var package: [String: Any] = ["format": "codex-skin-package", "version": 1, "skin": skin]
        if let hash = skin["asset"] as? String { package["media"] = try asset(hash) }
        return try JSONSerialization.data(withJSONObject: package, options: [.sortedKeys])
    }
    @discardableResult func importPackage(_ data: Data) throws -> [String: Any] {
        guard data.count < 92 * 1024 * 1024, let package = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw SkinError("皮肤文件无效或过大") }
        if package["format"] as? String == "codex-video-skin" {
            return try execute(["type": "create", "id": UUID().uuidString, "name": "导入的配置（未含背景）", "content": ["asset": NSNull(), "profiles": try legacyProfiles(package)]])
        }
        guard package["format"] as? String == "codex-skin-package", package["version"] as? Int == 1,
              let skin = package["skin"] as? [String: Any], let title = skin["name"] as? String else { throw SkinError("不支持的皮肤包版本") }
        // Validate before staging bytes. Imported IDs never replace local identities.
        _ = try invoke("content", [skin])
        if let hash = skin["asset"] as? String {
            guard let media = package["media"] as? [String: Any], let encoded = media["base64"] as? String,
                  let bytes = Data(base64Encoded: encoded), let mime = media["mime"] as? String else { throw SkinError("皮肤包缺少素材") }
            _ = try putAsset(data: bytes, mime: mime, name: media["name"] as? String ?? "背景", expected: hash)
        }
        var imported=skin
        imported["source"]=["kind":"package","id":skin["id"] ?? "unknown","revision":skin["revision"] ?? 1]
        return try execute(["type": "create", "id": UUID().uuidString, "name": title, "content": imported])
    }
}
