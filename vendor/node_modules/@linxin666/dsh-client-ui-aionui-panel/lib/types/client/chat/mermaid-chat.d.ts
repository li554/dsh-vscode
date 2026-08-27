/**
 * Chat-transcript mermaid enhancement: the shell conversation renderer
 * emits fenced code as `div.md-code-block` with the language in a banner
 * infostring element (no language class on pre/code), and the shell has no
 * slot for message-body post-processing — so this component rides the
 * conversation input dock as a zero-render sentinel and observes the
 * document for mermaid blocks the transcript mounts. Blocks inside the
 * preview panel's own subtree are excluded (each surface owns its blocks).
 *
 * Streaming awareness: an assistant message re-renders continuously, so a
 * diagram fence is often incomplete mid-stream. Renders that fail restore
 * the block and the next mutation retries it — once the fence closes the
 * diagram lands. Mutations are debounced to one rAF so long transcripts do
 * not re-scan the whole document: each batch is mapped to the minimal
 * mutated subtrees and scoped per-frame while the first scheduled pass scans
 * the body once. The observer is disconnected on unmount.
 * @module dsh-aionui-panel/client/chat/mermaid-chat
 */
import type { JSX } from 'react';
/**
 * Map a mutation batch to the minimal scan scopes that may contain new
 * mermaid fences. Each record contributes its target and its added nodes
 * (an added element directly; otherwise that node's parentElement), promoted
 * to the owning `.md-code-block` when present and deduped by identity.
 * Disconnected nodes and removed-only records yield nothing — removal never
 * introduces a fence. Pure (DOM-read only) so tests can drive it in jsdom.
 */
export declare function enhanceScopesFor(records: MutationRecord[]): Element[];
/**
 * Chat-side ownership guard: blocks inside the preview panel's own subtrees
 * (the markdown viewer scope marker, or the preview column hosting the code
 * viewers) belong to the panel drivers, never to the transcript enhancer.
 */
export declare function isPanelOwnedPre(pre: HTMLPreElement): boolean;
/**
 * Claim the buffered observer batch for one run. The buffer is drained
 * unconditionally: while the panel is absent, streaming mutations would
 * otherwise keep appending to pendingRecords without bound and pin DOM
 * nodes. The claimed batch is returned for scanning while the panel is
 * mounted, and discarded while it is absent — the next panel mount re-runs
 * the first full-document pass. Pure, so tests can drive it with plain
 * arrays.
 */
export declare function drainObserverBatch(pendingRecords: MutationRecord[], panelMounted: boolean): MutationRecord[];
/** Hidden sentinel: renders nothing, owns the transcript observer. */
export declare function MermaidChatEnhancer(): JSX.Element | null;
//# sourceMappingURL=mermaid-chat.d.ts.map