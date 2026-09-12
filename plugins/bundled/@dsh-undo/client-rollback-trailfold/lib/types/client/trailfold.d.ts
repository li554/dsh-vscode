/**
 * Per-turn "reasoning and actions" fold for the dsh web conversation trail.
 *
 * dsh's chat flow publishes one stable contract per node: the flow container
 * `[data-chat-flow]` whose children carry `data-chat-flow-kind` (user / steering /
 * context / assistant-step / tool-call / turn-tail) and a stable
 * `data-chat-flow-key`. A turn therefore reads, in order: the user item, its
 * trail (context injections, Think steps, narration steps, tool calls), the
 * final visible item (a delivered assistant conclusion, or a terminal tool
 * result), and the turn tail itself (deliverables + stats).
 *
 * This patch gives every turn with a foldable trail one collapse bar, so the
 * affordance shows in ALL cases where there is anything to fold — including
 * think-only and text-only-with-reasoning turns, which is what the fork's
 * main-tree trail fold did and what plain per-tool rows cannot express.
 *
 * React safety rules (the navIconPatch lessons):
 *   - never remove or reorder React-owned nodes: hiding happens by setting
 *     `style.display` on flow items (they carry no React-managed style prop),
 *     and the collapse bar is a foreign node React never reconciles;
 *   - everything is idempotent and re-derived: a MutationObserver rescans on
 *     every mutation batch, so React re-renders, virtualization remounts, and
 *     locale/edits heal automatically (a dropped bar is simply re-inserted).
 *
 * Fold semantics (main-tree parity):
 *   - the terminal item (last assistant step or tool result before the tail)
 *     and the tail itself stay visible — only the earlier trail folds;
 *   - a running turn (no tail yet) renders the bar expanded with a running
 *     hint and never auto-collapses mid-stream;
 *   - a turn that closes while observed auto-collapses — but only when the
 *     conversation is pinned near the bottom (following), so a reader scrolled
 *     up into the trail is never cut off;
 *   - history that loads already-collapsed stays expanded on first sight;
 *   - manual clicks always win until the turn's next auto event (its close);
 *   - a terminal tool result stays outside the fold, so an error remains
 *     visible while the preceding Think/narration can still be collapsed.
 */
/** One flow node as the planner sees it. */
export interface FlowItem {
    readonly el: HTMLElement;
    readonly kind: string;
    readonly key: string;
}
/** What the planner derived for one user-anchored turn. */
export interface TurnPlan {
    /** The user item's stable flow key (identity of the turn). */
    readonly key: string;
    /** The user message item (always visible; the bar sits right after it). */
    readonly userEl: HTMLElement;
    /** Trail nodes hidden while collapsed (excludes the visible terminal item). */
    readonly trail: readonly HTMLElement[];
    /** Visible terminal assistant/tool item anchored before the tail; null while running. */
    readonly conclusion: HTMLElement | null;
    /** True once the turn-tail arrived (or a newer user item abandoned it). */
    readonly closed: boolean;
    /** True while the tail has not arrived and this is the live end of the flow. */
    readonly running: boolean;
    /** Count of assistant steps inside the trail (Think + narration). */
    readonly thinkCount: number;
    /** Count of tool calls inside the trail. */
    readonly toolCount: number;
}
/**
 * Group flow items into user-anchored turns and derive each turn's fold plan.
 * Unknown kinds are passed through untouched (never boundary, never trail).
 * @param items - Flow children in document order.
 * @returns One plan per user item, in order.
 */
export declare function planTurns(items: readonly FlowItem[]): readonly TurnPlan[];
/** A fold gets a bar iff there is a trail to hide: running with items, or closed with a visible terminal item. */
export declare function foldable(plan: TurnPlan): boolean;
/**
 * Wire the fold into one live document.
 * @param doc - Document hosting the conversation (tests may pass a jsdom one).
 * @param classes - CSS-module class map for the bar chrome.
 * @param labels - Copy: bar title, running hint, and the count line builder.
 * @returns Disposer stopping the observer and dropping every foreign bar.
 */
export declare function mountTrailFold(doc: Document, classes: Record<string, string>, labels: {
    readonly title: string;
    readonly running: string;
    readonly counts: (think: number, tools: number) => string;
}): () => void;
//# sourceMappingURL=trailfold.d.ts.map