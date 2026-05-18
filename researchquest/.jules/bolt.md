## 2025-01-20 - Batching Sequential Network Requests in Promise Loops
**Learning:** Sequential awaits inside a loop for network bound tasks (like adding 500 parsed items individually) can result in slow execution times (linear `O(N)` scaling with network latency).
**Action:** Replace `for` loop `await`s with chunked batching using `Promise.allSettled`. This dramatically parallelizes tasks without destroying connection pooling or hitting immediate rate limits compared to unbounded `Promise.all`.
