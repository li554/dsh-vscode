/** Durable JSON validation for the conversation-undo data directory. */
import { z } from 'zod';
const id = z.string().min(1);
const sessionId = id.transform(value => value);
const messageId = id.transform(value => value);
const tree = z.string().regex(/^[0-9a-f]{40,64}$/).transform(value => value);
const logicalConversationId = id.transform(value => value);
/** Runtime schema for one app-owned snapshot journal manifest. */
export const conversationUndoJournalSchema = z.object({
    schemaVersion: z.literal(1),
    logicalConversationId,
    generation: z.number().int().nonnegative(),
    predecessorGeneration: z.number().int().nonnegative().optional(),
    shadowLayout: z.literal('lineage').optional(),
    sourceSessionId: sessionId,
    sourceTombstonePending: z.boolean().optional(),
    sourceTombstoned: z.boolean().optional(),
    revokeExpired: z.boolean().optional(),
    rollbackSessionId: sessionId.optional(),
    revokeSessionId: sessionId.optional(),
    messageId,
    prompt: z.string(),
    workspace: z.string().min(1),
    beforeTree: tree,
    afterTree: tree.optional(),
    completedAt: z.number().finite().nonnegative().optional(),
    redoTree: tree.optional(),
    rollbackTree: tree.optional(),
    retainedGeneration: z.number().int().nonnegative().optional(),
    replayPromptOnRevoke: z.boolean().optional(),
    turn: z.number().int().nonnegative(),
    phase: z.enum(['armed', 'ready', 'quiescing', 'restoring', 'complete', 'revoking', 'cleanup-pending', 'recovery-required']),
});
//# sourceMappingURL=spec.js.map