import Foundation

// One writer at a time. User actions wait for an in-flight transfer, and polling
// pauses while an action or its confirmation dialog is active.
@MainActor final class LibraryAutoSync {
    private let shouldRun: () -> Bool
    private let operation: () async throws -> Void
    private let onError: (Error) -> Void
    private var loop: Task<Void, Never>?
    private var pending: Task<Void, Never>?
    init(shouldRun: @escaping () -> Bool, operation: @escaping () async throws -> Void, onError: @escaping (Error) -> Void) {
        self.shouldRun = shouldRun; self.operation = operation; self.onError = onError
    }
    func start(interval: UInt64 = 2_000_000_000) {
        guard loop == nil else { return }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tick()
                do { try await Task.sleep(nanoseconds: interval) } catch { break }
            }
        }
    }
    func tick() async {
        guard pending == nil, shouldRun() else { return }
        let task = Task {
            do { try await operation() } catch { onError(error) }
        }
        pending = task
        await task.value
        pending = nil
    }
    func finishPending() async { await pending?.value }
    func stop() async {
        loop?.cancel(); loop = nil
        await finishPending()
    }
}
