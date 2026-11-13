import type { JSX } from 'react';
import { type MemorySpaceView, type MemoryGraphNode, type MemoryGraphSnapshot } from '../contracts.ts';
import { type MnemonTranslate } from 'dsh-mnemon/client';
export declare function graphNodeKey(node: MemoryGraphNode): string;
export declare function graphNodeKind(node: MemoryGraphNode): NonNullable<MemoryGraphNode['kind']>;
/** Add routing scopes and entity indexes without issuing another recall. */
export declare function enrichMultiSpaceGraph(graph: MemoryGraphSnapshot, bodies: MemorySpaceView[]): MemoryGraphSnapshot;
export declare function graphKindLabel(t: MnemonTranslate, node: MemoryGraphNode): string;
export declare function MemoryGraph(props: {
    graph: MemoryGraphSnapshot;
    selectedId?: string | undefined;
    onSelect: (node: MemoryGraphNode) => void;
}): JSX.Element;
