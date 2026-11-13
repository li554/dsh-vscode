/**
 * One row for each memory tool the Host registers: the Source Route or Action a named tool runs,
 * whether it reads, inspects or writes, and how the turn memory bar shows it. The result tool that
 * delegated children finish with runs no Source operation and has no row. Host modules and the
 * browser client read this table; each tool's model-visible description and schemas stay with its
 * registration in tools.ts. The two generic View tools run whichever Route or Action of the turn's
 * View a call names, so their rows name no Source and no page.
 */
/** A Memory System page the turn memory bar opens: Status, or a Source page id. */
export type MemoryToolPage = 'status' | `${string}/${string}`;
export interface MemoryToolEntry {
    /** The Source type whose Route or Action the tool runs. */
    readonly sourceTypeId?: string;
    /** The id of that Route or Action. */
    readonly operation?: string;
    /** `read` returns evidence, `inspect` health or a catalog, and `write` changes memory. */
    readonly kind: 'read' | 'inspect' | 'write';
    /** The page the tool's chip in the turn memory bar opens. */
    readonly page?: MemoryToolPage;
    /** The locale key that says what the tool did. */
    readonly label: `turnTail.tool.${string}`;
}
/** In registration order, which is also the order the View lists tools that share an operation. */
export declare const MEMORY_TOOLS: {
    readonly mnemon_view_route: {
        readonly kind: "read";
        readonly label: "turnTail.tool.viewRoute";
    };
    readonly mnemon_view_action: {
        readonly kind: "write";
        readonly label: "turnTail.tool.viewAction";
    };
    readonly mnemon_memory_bodies: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "inspect";
        readonly kind: "inspect";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.spaces";
    };
    readonly mnemon_recall: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "recall";
        readonly kind: "read";
        readonly page: "memory-spaces/explore";
        readonly label: "turnTail.tool.recall";
    };
    readonly mnemon_related: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "related";
        readonly kind: "read";
        readonly page: "memory-spaces/explore";
        readonly label: "turnTail.tool.related";
    };
    readonly mnemon_status: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "inspect";
        readonly kind: "inspect";
        readonly page: "status";
        readonly label: "turnTail.tool.status";
    };
    readonly mnemon_document_search: {
        readonly sourceTypeId: "documents";
        readonly operation: "search";
        readonly kind: "read";
        readonly page: "documents/library";
        readonly label: "turnTail.tool.documentSearch";
    };
    readonly mnemon_document_create: {
        readonly sourceTypeId: "documents";
        readonly operation: "create";
        readonly kind: "write";
        readonly page: "documents/library";
        readonly label: "turnTail.tool.documentCreate";
    };
    readonly mnemon_document_manage: {
        readonly sourceTypeId: "documents";
        readonly operation: "manage";
        readonly kind: "write";
        readonly page: "documents/library";
        readonly label: "turnTail.tool.documentManage";
    };
    readonly mnemon_runtime_memory: {
        readonly sourceTypeId: "runtime";
        readonly operation: "mutate";
        readonly kind: "write";
        readonly page: "runtime/entries";
        readonly label: "turnTail.tool.runtime";
    };
    readonly mnemon_remember: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "remember";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.remember";
    };
    readonly mnemon_link: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "link";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.link";
    };
    readonly mnemon_forget: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "forget";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.forget";
    };
    readonly mnemon_memory_body_create: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "manage-spaces";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.spaceCreate";
    };
    readonly mnemon_memory_body_update: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "manage-spaces";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.spaceUpdate";
    };
    readonly mnemon_memory_body_merge: {
        readonly sourceTypeId: "memory-spaces";
        readonly operation: "manage-spaces";
        readonly kind: "write";
        readonly page: "memory-spaces/spaces";
        readonly label: "turnTail.tool.spaceMerge";
    };
};
export type MemoryToolName = keyof typeof MEMORY_TOOLS;
export type MemoryToolLabel = (typeof MEMORY_TOOLS)[MemoryToolName]['label'];
/** The row of one memory tool, or undefined for any other tool name. */
export declare function memoryTool(name: string): (MemoryToolEntry & {
    readonly label: MemoryToolLabel;
}) | undefined;
/** Every memory tool name with its row, in table order. */
export declare function memoryTools(): Array<[MemoryToolName, MemoryToolEntry]>;
