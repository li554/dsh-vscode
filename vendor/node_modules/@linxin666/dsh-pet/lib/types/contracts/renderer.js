/**
 * Renderer contract — the seam between the pet center and its renderers
 * (issue #623, milestone M2 P4). Renderers never see the DSH session, the
 * registry, or the network: they receive exactly three capabilities — an
 * asset base URL, the ActivityPhase stream, and the interaction write-back —
 * inside a center-owned container. Every mount is a fresh activation whose
 * cleanups must be idempotent.
 *
 * This contract only serves real consumers: sprite2d (existing) and live2d
 * (M3). Speculative capabilities join only when a renderer actually needs
 * them.
 * @module @linxin666/dsh-pet/contracts/renderer
 */
/** Contract version renderers declare against (independent of the manifest). */
export const PET_RENDERER_API_VERSION = 'x-org.linxin666.pet-center/v1alpha1';
