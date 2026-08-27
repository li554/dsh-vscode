/**
 * Model-controlled URL fence for the describe-image tool. The image URL is supplied by the
 * model, so it must never name the host the plugin runs on, its private networks, its
 * link-local range (cloud metadata, e.g. 169.254.169.254), or the reserved loopback
 * addresses. Literal IPs are judged from the parsed URL — the WHATWG parser already
 * normalizes legacy decimal/hex/octal IPv4 forms — and domain names are resolved first so
 * /etc/hosts entries and private answers are refused too; an unresolvable domain fails
 * closed. Rejections carry one generic wording and never response statuses or other
 * host-internal facts.
 * @module @linxin666/dsh-tool-describe-image/url-guard
 */
/** Parse a dotted-quad IPv4 literal into its 32-bit integer; undefined when not a literal. */
export declare function ipv4ToInt(ip: string): bigint | undefined;
/**
 * Parse a bare IPv6 literal (no brackets, optional %zone tail and dotted-quad tail) into
 * its 128-bit integer; undefined when malformed. The WHATWG URL host keeps brackets, so the
 * caller strips them before this parse.
 */
export declare function ipv6ToInt(ip: string): bigint | undefined;
/** Whether one IPv4 address value falls in a blocked CIDR. */
export declare function isBlockedIpv4Value(value: bigint): boolean;
/** Whether one IPv6 value falls in a blocked CIDR; IPv4-mapped addresses are judged as IPv4. */
export declare function isBlockedIpv6Value(value: bigint): boolean;
/** Whether a normalized (bracket- and trailing-dot-stripped) hostname is a localhost variant. */
export declare function isLocalhostVariant(name: string): boolean;
/** One resolved address. */
export interface ResolvedAddress {
    address: string;
    family: 4 | 6;
}
/** Resolver seam: every address for one hostname (injectable for tests). */
export type AddressResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;
/** Rejection wording for blocked hosts; never carries response statuses or internal facts. */
export declare const IMAGE_URL_NOT_ALLOWED = "describe-image: image URL target is not allowed";
/** Rejection wording when a domain cannot be resolved; the guard fails closed. */
export declare const IMAGE_URL_UNRESOLVABLE = "describe-image: image URL target could not be resolved";
/**
 * Assert one http(s) URL may be fetched by the tool: its host must not be a private,
 * loopback, link-local, or reserved address — as a literal IP or through DNS resolution.
 * @param rawUrl - the complete http(s) URL.
 * @param resolve - address resolver (defaults to the system resolver).
 * @throws `IMAGE_URL_NOT_ALLOWED` for blocked hosts, `IMAGE_URL_UNRESOLVABLE` when a domain
 * cannot be resolved.
 */
export declare function assertImageUrlAllowed(rawUrl: string, resolve?: AddressResolver): Promise<void>;
//# sourceMappingURL=url-guard.d.ts.map