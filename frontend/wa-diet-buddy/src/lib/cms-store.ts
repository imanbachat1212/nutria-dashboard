// cms-store.ts — the in-memory useSyncExternalStore has been replaced by React Query.
// This file re-exports the makeBlock factory so existing imports from this path keep working.
export { makeBlock } from "./cms-api";
