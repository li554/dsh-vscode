/**
 * Dependency specification classification for profile manifests.
 *
 * The classifier is intentionally conservative: anything it cannot place into
 * a pinned, offline-provable form is reported as 'range' or 'unknown' so the
 * diagnosis layer can warn instead of silently assuming reproducibility.
 */
import type { DependencySpec } from './types.ts';
/** Split 'name@specifier' handling scoped names; returns [name, sub] or null. */
export declare function splitPackageSpec(raw: string): {
    name: string;
    sub?: string;
} | null;
/** Classify one dependency specifier. */
export declare function classifySpec(raw: string): DependencySpec;
/** Whether a spec is already pinned to a single exact artifact. */
export declare function isPinned(spec: DependencySpec): boolean;
/** Whether a git spec names a commit-ish ref (7+ hex digits). */
export declare function isCommitPinnedGit(spec: DependencySpec): boolean;
/** Canonical display form for one spec. */
export declare function canonicalSpec(spec: DependencySpec): string;
/** Whether a spec points at a local filesystem path (link/file). */
export declare function isLocalSpec(spec: DependencySpec): boolean;
