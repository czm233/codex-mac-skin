import Foundation

@main struct LibraryChecks {
    static func main() throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let model = URL(fileURLWithPath: CommandLine.arguments[2])
        let library = try SkinLibrary(root: root, modelURL: model)
        let profiles: [String: Any] = ["dark": ["dim": 0.2], "light": ["dim": 0.1]]
        let image = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        let hash = try library.putAsset(data: image, mime: "image/png", name: "test.png")
        let content: [String: Any] = ["asset": hash, "profiles": profiles]
        _ = try library.execute(["type": "create", "id": "one", "name": "原皮肤", "content": content])
        _ = try library.execute(["type": "duplicate", "id": "two", "sourceId": "one", "name": "共享背景"])
        let assets = try FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("assets").path)
        precondition(assets.count == 1, "shared media must be deduplicated")
        let reopened = try SkinLibrary(root: root, modelURL: model)
        let reopenedState = try reopened.read(); precondition(reopenedState["revision"] as? Int == 2)
        let package = try reopened.exportPackage("one")
        _ = try reopened.importPackage(package)
        let importedState = try reopened.read(); precondition((importedState["skins"] as? [Any])?.count == 3)
        _ = try reopened.execute(["type": "draft", "id": "offline", "skinId": "one", "baseRevision": 1, "content": content])
        _ = try library.execute(["type": "rename", "id": "one", "name": "更新名称"])
        do { _ = try reopened.execute(["type": "save", "id": "offline"]); fatalError("stale draft accepted") } catch {}
        _ = try reopened.execute(["type": "save", "id": "offline", "copyId": "conflict", "name": "冲突副本"])
        let before = try Data(contentsOf: root.appendingPathComponent("library.json"))
        do { _ = try library.putAsset(data: image, mime: "image/png", name: "bad", expected: String(repeating: "0", count: 64)); fatalError("corrupt asset accepted") } catch {}
        do { _ = try library.execute(["type": "create", "id": "missing", "name": "缺失", "content": ["asset": String(repeating: "0", count: 64), "profiles": profiles]]); fatalError("missing asset accepted") } catch {}
        let afterFailure = try Data(contentsOf: root.appendingPathComponent("library.json")); precondition(afterFailure == before)
        let backupsURL = root.appendingPathComponent("backups"), movedBackups = root.appendingPathComponent("backups-saved")
        try FileManager.default.moveItem(at: backupsURL, to: movedBackups)
        try Data("blocked".utf8).write(to: backupsURL)
        do { _ = try library.execute(["type": "rename", "id": "one", "name": "写入失败"]); fatalError("backup failure ignored") } catch {}
        let afterWriteFailure = try Data(contentsOf: root.appendingPathComponent("library.json"))
        precondition(afterWriteFailure == before)
        try FileManager.default.removeItem(at: backupsURL)
        try FileManager.default.moveItem(at: movedBackups, to: backupsURL)
        // Force a durable write failure with an existing directory at the index path.
        let index = root.appendingPathComponent("library.json"), old = root.appendingPathComponent("saved.json")
        try FileManager.default.moveItem(at: index, to: old)
        try FileManager.default.createDirectory(at: index, withIntermediateDirectories: false)
        do { _ = try library.execute(["type": "rename", "id": "one", "name": "失败"]); fatalError("invalid index overwritten") } catch {}
        try FileManager.default.removeItem(at: index)
        try FileManager.default.moveItem(at: old, to: index)
        let recovered = try Data(contentsOf: index); precondition(recovered == before)
        let backups = try FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("backups").path); precondition(!backups.isEmpty)
        print("Native library: reopen, deduplication, package roundtrip, conflict preservation, corruption and failure recovery passed")
    }
}
