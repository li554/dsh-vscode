/**
 * Repair-conversation seed text. Two failure surfaces hand off to the agent
 * through the same shape: a failed install (target spec + install error) and
 * a recorded boot failure (the failure-ring row). The seeded message must be
 * self-contained — the repair session's workspace is the plugin install root,
 * so the agent's file tools reach the plugin code without leaving the
 * workspace boundary.
 *
 * Secret discipline: the seed carries only the spec, the host's truncated
 * failure message/stack, and paths. Callers must never append credentials,
 * tokens, or environment contents; the failure ring is the host's bounded,
 * pruned record and nothing else is added.
 * @module @linxin666/dsh-client-ui-plugin-manager/core
 */
import type { PluginFailureItem } from './protocol.ts';
import type { LayerState } from './patch-diff.ts';
/** Localized fragments the builders assemble. */
export interface RepairCopy {
    installTitle: string;
    installSpecLabel: string;
    installErrorLabel: string;
    installAsk: string;
    failureTitle: string;
    failurePluginLabel: string;
    failureKindLabel: string;
    failureAtLabel: string;
    failureMessageLabel: string;
    failureStackLabel: string;
    failurePathLabel: string;
    failureAsk: string;
    conflictTitle: string;
    conflictPluginLabel: string;
    conflictChangeLabel: string;
    conflictAsk: string;
    /** Localized names of the failure kinds. */
    kindNames: Record<PluginFailureItem['kind'], string>;
    /** Localized names of the layer states a conflict change traverses. */
    stateNames: Record<LayerState, string>;
}
/** Default copy (zh): the package's zh dictionary keys map onto these strings. */
export declare const DEFAULT_REPAIR_COPY: RepairCopy;
/**
 * Seed text for a failed install: the target and the rendered error,
 * self-contained for the agent.
 * @param spec - the install target (npm spec or git URL) that failed.
 * @param error - the rendered install error text.
 * @param copy - localized fragments.
 * @returns the repair prompt text.
 */
export declare function installRepairMessage(spec: string, error: string, copy?: RepairCopy): string;
/**
 * Seed text for one boot-failure ring row: the failure record, so the agent
 * can attribute and fix it in place.
 * @param failure - the recorded failure row.
 * @param copy - localized fragments.
 * @returns the repair prompt text.
 */
export declare function failureRepairMessage(failure: PluginFailureItem, copy?: RepairCopy): string;
/**
 * Seed text for one install-conflict notice: the entry and its state change,
 * so the agent can attribute the conflict and resolve the double mount.
 * @param change - the conflict change (id, display name, from/to states).
 * @param copy - localized fragments.
 * @returns the repair prompt text.
 */
export declare function conflictRepairMessage(change: {
    id: string;
    name: string;
    from: LayerState;
    to: LayerState;
}, copy?: RepairCopy): string;
