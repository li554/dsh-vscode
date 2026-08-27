/**
 * Status-decoration contract — the L3 extension slot for small status
 * ornaments (issue #623 milestone M5, protocol #567, first reference
 * implementation #463). A decoration is an INDEPENDENT content entry (own
 * id, own directory, own descriptor) whose PNG/WebP sprite strip ornaments
 * the pet center's status bubble chrome; it never touches the pet
 * manifests and never changes the bubble's semantics.
 *
 * Adopted disciplines (#623): entry assets are PNG/WebP sprite strips only
 * (no SVG, no CSS animation); the bubble's own role=status/aria-live (or
 * session-bubble button semantics) always stays intact and the ornament is
 * aria-hidden; load failure or prefers-reduced-motion degrades to no
 * ornament or the static first frame.
 *
 * The ActivityPhase stream the pet center owns drives the ornament: each
 * phase binds to a frame segment (inclusive from/to indices into the
 * strip) or to 'hide' (no ornament for that phase; the default).
 * @module @linxin666/dsh-pet/contracts/status-decoration
 */
/** Contract version decorations declare against (independent of manifests). */
export const PET_DECORATION_API_VERSION = 'x-org.linxin666.pet-center/status-decoration-v1';
