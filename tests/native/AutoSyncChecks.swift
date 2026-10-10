import Foundation

@main struct AutoSyncChecks {
    @MainActor static func main() async throws {
        var busy = true, calls = 0, errors = 0, active = 0, maximum = 0
        enum Failure: Error { case temporary }
        let sync = LibraryAutoSync(shouldRun: { !busy }, operation: {
            calls += 1; active += 1; maximum = max(maximum, active)
            defer { active -= 1 }
            try await Task.sleep(nanoseconds: 10_000_000)
            if calls == 1 { throw Failure.temporary }
        }, onError: { _ in errors += 1 })
        await sync.tick(); precondition(calls == 0)
        busy = false
        sync.start(interval: 5_000_000)
        // A failure must be retried without user input; overlapping ticks must not
        // create simultaneous writers.
        for _ in 0..<100 {
            await sync.tick()
            if calls >= 3 { break }
            try await Task.sleep(nanoseconds: 5_000_000)
        }
        busy = true
        await sync.finishPending()
        precondition(calls >= 3 && errors == 1 && maximum == 1 && active == 0)
        let before = calls
        try await Task.sleep(nanoseconds: 20_000_000)
        precondition(calls == before)
        await sync.stop()
        print("Automatic sync: retry, serialization and foreground exclusion passed")
    }
}
