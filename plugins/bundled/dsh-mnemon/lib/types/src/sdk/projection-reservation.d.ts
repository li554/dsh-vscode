import type { MemorySourceFacts, MemoryViewSpec } from '../core/contracts/index.ts';
/** Reserve complete Source-declared resident data inside the existing View ceiling. */
export declare function reserveMemoryProjection(spec: MemoryViewSpec, sources: readonly MemorySourceFacts[], budget: number): MemoryViewSpec;
