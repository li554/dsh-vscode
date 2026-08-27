/**
 * dsh-archive-manager — host half (TypeScript source).
 *
 * This is the TypeScript companion source for lib/index.js.
 * Registers HTTP routes under /api/dsh-archive-manager/* that let the browser
 * settings card list, preview, restore, and permanently delete archived sessions.
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable cordis plugin name. */
export const name = 'archive-manager'

/** Services required (webServer for route registration, workspaceRegistry for live state sync). */
export const inject = ['webServer', 'workspaceRegistry']

/** One archived session as returned to the browser. */
export interface ArchiveInfo {
  sessionId: string
  title: string | null
  workspacePath: string | null
  workspaceTitle: string | null
  workspaceId: string | null
  createdAt: number | null
  turns: number
  outputTokens: number
  dataSize: number
  hasDataFile: boolean
}

export function apply(ctx: Context, _config?: any): void {
  void ctx
  void _config
}
