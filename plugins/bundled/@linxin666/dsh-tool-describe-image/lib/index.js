import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { lookup } from "node:dns/promises";
import z from "schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
//#region src/media.ts
/** The accepted image media types, in stable order. */
const IMAGE_MEDIA_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp"
];
/** Upper bound on image bytes (local files and downloaded URLs alike). */
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
/** Whether the declared media type is one the plugin accepts. */
function isImageMimeType(value) {
	return typeof value === "string" && IMAGE_MEDIA_TYPES.includes(value);
}
/**
* Detect the image media type from magic bytes.
* @param bytes - the leading bytes of the input.
* @returns the accepted media type, or `undefined` for unknown or truncated inputs.
*/
function sniffMimeType(bytes) {
	if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
	if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
	if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
	if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
	if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
}
/**
* Strictly decode a base64 payload: the standard alphabet, correct padding,
* and a length that is a multiple of four. Rejects anything `Buffer.from`
* would silently tolerate.
* @param encoded - the base64 text.
* @returns the decoded bytes, or `undefined` when the text is not valid base64.
*/
function decodeBase64(encoded) {
	if (encoded.length === 0 || encoded.length % 4 !== 0) return void 0;
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return void 0;
	if (/=/.test(encoded) && !/={1,2}$/.test(encoded)) return void 0;
	const bytes = Buffer.from(encoded, "base64");
	if (bytes.toString("base64") !== encoded) return void 0;
	return bytes;
}
//#endregion
//#region src/attachment-reference.ts
/** Error text shown when a model-supplied attachment reference does not validate. */
const ATTACHMENT_REF_GUIDANCE = "describe-image: image is not a valid attachment reference; pass the complete [image attachment ...] note or generated Markdown reference";
const ATTACHMENT_NOTE_PREFIX = "[image attachment ";
const MARKDOWN_REFERENCE = /^!\[[^\]]*]\((\/describe-image\/raw\/([^/?\s)]+)(?:\?[^)\s]*)?)\)$/;
/** Escape a URL component for Markdown, including delimiters encodeURIComponent leaves literal. */
function encodeMarkdownComponent(value) {
	return encodeURIComponent(value).replace(/\(/g, "%28").replace(/\)/g, "%29");
}
/** Narrow an unknown value to a plain, non-array object, or undefined. */
function asRecord$2(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	return value;
}
/** Whether a record field holds a positive safe integer. */
function isPositiveSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
/** A non-empty string from a record under `key`, else undefined. */
function nonEmptyString(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** Remove the optional `[image attachment ...]` carrier around its JSON reference. */
function unwrapAttachmentNote(raw) {
	const trimmed = raw.trim();
	if (!trimmed.startsWith(ATTACHMENT_NOTE_PREFIX)) return trimmed;
	if (!trimmed.endsWith("]")) throw new Error(ATTACHMENT_REF_GUIDANCE);
	return trimmed.slice(18, -1).trim();
}
/**
* Validate and narrow a model-supplied attachment reference into its typed storage
* form. It accepts either the raw JSON reference or its complete note carrier.
* @param raw - JSON or `[image attachment ...]` content from a session message.
* @returns the narrowed, typed reference.
*/
function parseImageAttachmentRef(raw) {
	let parsed;
	try {
		parsed = JSON.parse(unwrapAttachmentNote(raw));
	} catch {
		throw new Error(ATTACHMENT_REF_GUIDANCE);
	}
	const record = asRecord$2(parsed);
	if (record === void 0) throw new Error(ATTACHMENT_REF_GUIDANCE);
	const attachmentId = nonEmptyString(record, "attachmentId");
	const mediaType = record["mediaType"];
	const bytes = record["bytes"];
	const width = record["width"];
	const height = record["height"];
	const name = record["name"];
	if (attachmentId === void 0 || !isImageMimeType(mediaType) || !isPositiveSafeInteger(bytes) || !isPositiveSafeInteger(width) || !isPositiveSafeInteger(height) || name !== void 0 && typeof name !== "string") throw new Error(ATTACHMENT_REF_GUIDANCE);
	return {
		attachmentId,
		mediaType,
		bytes,
		width,
		height,
		...name === void 0 ? {} : { name }
	};
}
/**
* Parse the plugin's Markdown image form. Legacy id-only Markdown yields no `ref`;
* current Markdown embeds the full immutable reference in its query string.
* @param raw - a complete Markdown image reference.
* @returns the parsed route id and optional durable reference, or undefined when not this syntax.
*/
function parseMarkdownAttachmentReference(raw) {
	const match = MARKDOWN_REFERENCE.exec(raw.trim());
	if (match === null) return void 0;
	let attachmentId;
	try {
		attachmentId = decodeURIComponent(match[2] ?? "");
	} catch {
		throw new Error(ATTACHMENT_REF_GUIDANCE);
	}
	if (attachmentId === "") throw new Error(ATTACHMENT_REF_GUIDANCE);
	const encodedRef = new URL(match[1] ?? "", "http://dsh.local").searchParams.get("ref");
	if (encodedRef === null) return { attachmentId };
	const ref = parseImageAttachmentRef(encodedRef);
	if (ref.attachmentId !== attachmentId) throw new Error(ATTACHMENT_REF_GUIDANCE);
	return {
		attachmentId,
		ref
	};
}
function attachmentMarkdown(refOrId) {
	const encodedId = encodeMarkdownComponent(typeof refOrId === "string" ? refOrId : refOrId.attachmentId).replace(/%3A/gi, ":");
	if (typeof refOrId === "string") return `![图片](/describe-image/raw/${encodedId})`;
	return `![图片](/describe-image/raw/${encodedId}?ref=${encodeMarkdownComponent(JSON.stringify(refOrId))})`;
}
//#endregion
//#region src/model-capability.ts
/** The conservative answer: unknown means "keep the legacy rewrite". */
const UNKNOWN_CAPABILITY = {
	acceptsImages: false,
	known: false
};
/** Per-route metadata cache TTL: adapter model facts do not drift mid-process. */
const ROUTE_OK_TTL_MS = 600 * 1e3;
/** Failed resolutions retry sooner: a cold adapter may come up later. */
const ROUTE_ERR_TTL_MS = 30 * 1e3;
/** A hung adapter interrogation must never stall a send. */
const RESOLVE_TIMEOUT_MS = 3e3;
/** Read an optional, possibly untyped cordis service by name. */
function optionalService(ctx, name) {
	return ctx.get.call(ctx, name);
}
/**
* Create the shared exact-route resolver: model-metadata resolutions cached
* per route (successes for ten minutes, failures for thirty seconds,
* in-flight calls deduped). Both the capability probe and the tool-visibility
* controller resolve through one instance so a session's verdict is
* consistent across the two seams.
* @param ctx - registrant context carrying the optional llm service.
* @returns the route-keyed resolver.
*/
function createRouteResolver(ctx) {
	const routeCache = /* @__PURE__ */ new Map();
	const routeInflight = /* @__PURE__ */ new Map();
	const resolver = (async (route) => {
		const key = route.provider + "/" + route.model;
		const hit = routeCache.get(key);
		if (hit !== void 0 && Date.now() - hit.at < (hit.cap.known ? ROUTE_OK_TTL_MS : ROUTE_ERR_TTL_MS)) return hit.cap;
		const pending = routeInflight.get(key);
		if (pending !== void 0) return pending;
		const task = (async () => {
			const llm = optionalService(ctx, "llm");
			if (llm === void 0 || typeof llm.resolveModelInfo !== "function") return UNKNOWN_CAPABILITY;
			let timer;
			try {
				const modalities = (await Promise.race([llm.resolveModelInfo(route.provider, route.model), new Promise((_, reject) => {
					timer = setTimeout(() => reject(/* @__PURE__ */ new Error("resolveModelInfo timed out")), RESOLVE_TIMEOUT_MS);
				})])).inputModalities;
				if (modalities === void 0) return UNKNOWN_CAPABILITY;
				return {
					acceptsImages: modalities.includes("image"),
					known: true
				};
			} catch {
				return UNKNOWN_CAPABILITY;
			} finally {
				clearTimeout(timer);
			}
		})();
		routeInflight.set(key, task);
		try {
			const cap = await task;
			routeCache.set(key, {
				at: Date.now(),
				cap
			});
			return cap;
		} finally {
			routeInflight.delete(key);
		}
	});
	resolver.invalidate = (route) => {
		routeCache.delete(route.provider + "/" + route.model);
	};
	return resolver;
}
/**
* Create the per-mount probe. The session's model comes from its own logged
* request route (the exact config the loop assembled, so a session resumed
* with a history keeps the model it was running), then the agentDefaultModel
* service (a fresh session with no requests yet runs the current default
* selection). A session that resolves no route at all answers unknown,
* keeping the always-safe rewrite.
* @param ctx - registrant context carrying the optional agents and agentDefaultModel services.
* @param resolver - shared exact-route resolver (defaults to a private one).
* @returns the session-id-keyed probe.
*/
function createCapabilityProbe(ctx, resolver = createRouteResolver(ctx)) {
	return async (sessionId) => {
		const logged = optionalService(ctx, "agents")?.get(sessionId)?.session?.requestHeader?.()?.config;
		if (typeof logged?.provider === "string" && logged.provider !== "" && typeof logged.model === "string" && logged.model !== "") return resolver({
			provider: logged.provider,
			model: logged.model
		});
		const fallback = optionalService(ctx, "agentDefaultModel")?.currentSelection();
		if (typeof fallback?.provider === "string" && fallback.provider !== "" && typeof fallback.model === "string" && fallback.model !== "") return resolver({
			provider: fallback.provider,
			model: fallback.model
		});
		return UNKNOWN_CAPABILITY;
	};
}
//#endregion
//#region src/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/url-guard.ts
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
const BLOCKED_V4 = [
	{
		base: ipv4ToInt("0.0.0.0"),
		bits: 8
	},
	{
		base: ipv4ToInt("10.0.0.0"),
		bits: 8
	},
	{
		base: ipv4ToInt("127.0.0.0"),
		bits: 8
	},
	{
		base: ipv4ToInt("169.254.0.0"),
		bits: 16
	},
	{
		base: ipv4ToInt("172.16.0.0"),
		bits: 12
	},
	{
		base: ipv4ToInt("192.168.0.0"),
		bits: 16
	}
];
const BLOCKED_V6 = [
	{
		base: 0n,
		bits: 128
	},
	{
		base: 1n,
		bits: 128
	},
	{
		base: ipv6ToInt("fc00::"),
		bits: 7
	},
	{
		base: ipv6ToInt("fe80::"),
		bits: 10
	}
];
/** Parse a dotted-quad IPv4 literal into its 32-bit integer; undefined when not a literal. */
function ipv4ToInt(ip) {
	const parts = ip.split(".");
	if (parts.length !== 4) return void 0;
	let value = 0n;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return void 0;
		const octet = Number(part);
		if (octet > 255) return void 0;
		value = value << 8n | BigInt(octet);
	}
	return value;
}
/** Parse one 16-bit IPv6 group from its hex text; undefined when malformed. */
function ipv6GroupToInt(group) {
	if (!/^[0-9a-f]{1,4}$/i.test(group)) return void 0;
	return BigInt(`0x${group}`);
}
/**
* Parse a bare IPv6 literal (no brackets, optional %zone tail and dotted-quad tail) into
* its 128-bit integer; undefined when malformed. The WHATWG URL host keeps brackets, so the
* caller strips them before this parse.
*/
function ipv6ToInt(ip) {
	let input = ip.trim().toLowerCase();
	const zone = input.indexOf("%");
	if (zone !== -1) input = input.slice(0, zone);
	let v4Tail;
	const lastColon = input.lastIndexOf(":");
	const tail = lastColon === -1 ? input : input.slice(lastColon + 1);
	if (tail.includes(".")) {
		const parsed = ipv4ToInt(tail);
		if (parsed === void 0) return void 0;
		v4Tail = parsed;
		input = lastColon === -1 ? "" : input.slice(0, lastColon);
	}
	const pieces = input.split(":");
	const hasDouble = pieces.includes("");
	const hex = pieces.filter((piece) => piece !== "");
	const tailGroups = v4Tail === void 0 ? 0 : 2;
	if (hex.length + tailGroups > 8) return void 0;
	let value = 0n;
	if (hasDouble) {
		const before = [];
		const after = [];
		let sawDouble = false;
		for (const piece of pieces) {
			if (piece === "") {
				sawDouble = true;
				continue;
			}
			(sawDouble ? after : before).push(piece);
		}
		const beforeValues = before.map(ipv6GroupToInt);
		const afterValues = after.map(ipv6GroupToInt);
		if (beforeValues.includes(void 0) || afterValues.includes(void 0)) return void 0;
		const expansion = 8 - beforeValues.length - afterValues.length - tailGroups;
		if (expansion < 0) return void 0;
		for (const group of beforeValues) value = value << 16n | group;
		for (let index = 0; index < expansion; index += 1) value <<= 16n;
		for (const group of afterValues) value = value << 16n | group;
	} else {
		if (pieces.length + tailGroups !== 8) return void 0;
		for (const piece of pieces) {
			const group = ipv6GroupToInt(piece);
			if (group === void 0) return void 0;
			value = value << 16n | group;
		}
	}
	if (v4Tail !== void 0) value = value << 32n | v4Tail;
	return value;
}
/** Whether one IPv4 address value falls in a blocked CIDR. */
function isBlockedIpv4Value(value) {
	return BLOCKED_V4.some((candidate) => value >> BigInt(32 - candidate.bits) === candidate.base >> BigInt(32 - candidate.bits));
}
/** The embedded IPv4 value of an IPv4-mapped address, or undefined otherwise. */
function ipv4MappedValue(value) {
	if (value >> 48n === 0n && (value >> 32n & 65535n) === 65535n) return value & 4294967295n;
}
/** Whether one IPv6 value falls in a blocked CIDR; IPv4-mapped addresses are judged as IPv4. */
function isBlockedIpv6Value(value) {
	const mapped = ipv4MappedValue(value);
	if (mapped !== void 0) return isBlockedIpv4Value(mapped);
	return BLOCKED_V6.some((candidate) => value >> BigInt(128 - candidate.bits) === candidate.base >> BigInt(128 - candidate.bits));
}
/** Whether a normalized (bracket- and trailing-dot-stripped) hostname is a localhost variant. */
function isLocalhostVariant(name) {
	return name === "localhost" || name.endsWith(".localhost") || name === "localhost.localdomain";
}
const systemResolver = async (hostname) => {
	return (await lookup(hostname, { all: true })).map((entry) => ({
		address: entry.address,
		family: entry.family
	}));
};
/** Rejection wording for blocked hosts; never carries response statuses or internal facts. */
const IMAGE_URL_NOT_ALLOWED = "describe-image: image URL target is not allowed";
/** Rejection wording when a domain cannot be resolved; the guard fails closed. */
const IMAGE_URL_UNRESOLVABLE = "describe-image: image URL target could not be resolved";
/**
* Assert one http(s) URL may be fetched by the tool: its host must not be a private,
* loopback, link-local, or reserved address — as a literal IP or through DNS resolution.
* @param rawUrl - the complete http(s) URL.
* @param resolve - address resolver (defaults to the system resolver).
* @throws `IMAGE_URL_NOT_ALLOWED` for blocked hosts, `IMAGE_URL_UNRESOLVABLE` when a domain
* cannot be resolved.
*/
async function assertImageUrlAllowed(rawUrl, resolve = systemResolver) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error(IMAGE_URL_NOT_ALLOWED);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(IMAGE_URL_NOT_ALLOWED);
	const hostname = url.hostname.toLowerCase();
	if (isLoopbackHostname(hostname)) throw new Error(IMAGE_URL_NOT_ALLOWED);
	const name = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
	if (name === "" || isLocalhostVariant(name)) throw new Error(IMAGE_URL_NOT_ALLOWED);
	const v4 = ipv4ToInt(name);
	if (v4 !== void 0) {
		if (isBlockedIpv4Value(v4)) throw new Error(IMAGE_URL_NOT_ALLOWED);
		return;
	}
	if (name.includes(":")) {
		const v6 = ipv6ToInt(name);
		if (v6 === void 0 || isBlockedIpv6Value(v6)) throw new Error(IMAGE_URL_NOT_ALLOWED);
		return;
	}
	let addresses;
	try {
		addresses = await resolve(name);
	} catch {
		throw new Error(IMAGE_URL_UNRESOLVABLE);
	}
	for (const entry of addresses) if (entry.family === 4 ? isBlockedIpv4Value(ipv4ToInt(entry.address) ?? 0n) : isBlockedIpv6Value(ipv6ToInt(entry.address) ?? 0n)) throw new Error(IMAGE_URL_NOT_ALLOWED);
}
//#endregion
//#region src/image-compress.ts
/**
* Send-time image compression for the describe-image tool: mirrors the DSH native
* attachment normalization (long edge capped at 2048, JPEG quality 85) so one
* large image cannot blow the vision model's context window with an oversized
* base64 payload. JPEG and PNG inputs whose longest edge exceeds 2048 or whose
* encoded bytes exceed 256 KiB are decoded, proportionally downscaled with a
* bilinear resampler, alpha-composited onto white, and re-encoded as a
* quality-85 JPEG; anything the pipeline cannot improve — GIF, WebP, interlaced
* or undecodable inputs, or a re-encode that grew the bytes — passes through
* byte-identically. Only host-provided pure-JS modules do the heavy lifting
* (jpeg-js for JPEG decoding and encoding, fflate for PNG's zlib stream), each
* imported lazily so a missing host dependency degrades to pass-through, never
* failure.
*/
const MAX_EDGE = 2048;
const BYTE_TRIGGER = 262144;
const JPEG_QUALITY = 85;
const MAX_MEGAPIXELS = 100;
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
/**
* Compress one loaded image before it reaches the vision endpoint: JPEG and PNG
* inputs whose longest edge exceeds 2048 or whose bytes exceed 256 KiB are
* downscaled to a 2048 long edge (bilinear) and re-encoded as a quality-85 JPEG
* over a white background. GIF and WebP inputs, undecodable bytes, and re-encodes
* that would grow the image are returned unchanged.
* @param image - the loaded bytes and sniffed media type.
* @returns the possibly recompressed bytes and their media type.
*/
async function compressIfNeeded(image) {
	const { bytes, mimeType } = image;
	if (mimeType !== "image/jpeg" && mimeType !== "image/png") return image;
	try {
		if (bytes.length <= BYTE_TRIGGER) {
			const size = mimeType === "image/png" ? readPngHeader(bytes) : jpegSofSize(bytes);
			if (size === void 0 || Math.max(size.width, size.height) <= MAX_EDGE) return image;
		}
		const decoded = mimeType === "image/png" ? await decodePng(bytes) : await decodeJpeg(bytes);
		if (decoded === void 0) return image;
		flattenAlphaOntoWhite(decoded.data);
		let target = decoded;
		if (Math.max(decoded.width, decoded.height) > MAX_EDGE) {
			const scaled = scaledSize(decoded.width, decoded.height);
			target = {
				width: scaled.width,
				height: scaled.height,
				data: resizeBilinear(decoded.data, decoded.width, decoded.height, scaled.width, scaled.height)
			};
		}
		const { encode } = await import("jpeg-js");
		const encoded = encode({ data: target.data, width: target.width, height: target.height }, JPEG_QUALITY);
		if (encoded.data.length >= bytes.length) return image;
		return { bytes: Buffer.from(encoded.data), mimeType: "image/jpeg" };
	} catch {
		return image;
	}
}
/**
* Read one PNG's IHDR, or undefined when the bytes are not a well-formed PNG start.
*/
function readPngHeader(bytes) {
	if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return void 0;
	if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") return void 0;
	const width = bytes.readUInt32BE(16);
	const height = bytes.readUInt32BE(20);
	if (width === 0 || height === 0) return void 0;
	if (bytes[26] !== 0 || bytes[27] !== 0) return void 0;
	return { width, height, bitDepth: bytes[24], colorType: bytes[25], interlace: bytes[28] };
}
/**
* Read one JPEG's frame dimensions by walking its markers to the first SOF
* segment, or undefined when the bytes are not a well-formed JPEG start.
*/
function jpegSofSize(bytes) {
	if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return void 0;
	let offset = 2;
	while (offset + 1 < bytes.length) {
		if (bytes[offset] !== 255) return void 0;
		const marker = bytes[offset + 1];
		if (marker === 255) {
			offset += 1;
			continue;
		}
		if (marker === 216 || marker === 217 || marker === 1 || marker >= 208 && marker <= 215) {
			offset += 2;
			continue;
		}
		if (offset + 4 > bytes.length) return void 0;
		const length = bytes.readUInt16BE(offset + 2);
		if (length < 2 || offset + 2 + length > bytes.length) return void 0;
		if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
			if (length < 8) return void 0;
			const height = bytes.readUInt16BE(offset + 5);
			const width = bytes.readUInt16BE(offset + 7);
			if (width === 0 || height === 0) return void 0;
			return { width, height };
		}
		if (marker === 218) return void 0;
		offset += 2 + length;
	}
	return void 0;
}
/**
* Decode one JPEG to RGBA via the host-provided jpeg-js.
*/
async function decodeJpeg(bytes) {
	try {
		const { decode } = await import("jpeg-js");
		const decoded = decode(bytes, { useTArray: true, formatAsRGBA: true });
		return { width: decoded.width, height: decoded.height, data: decoded.data };
	} catch {
		return void 0;
	}
}
/**
* Minimal non-interlaced PNG decoder: IHDR/PLTE/tRNS/IDAT, color types
* 0/2/3/4/6, bit depths 8 and 16 (16-bit samples keep their high byte), and
* filters 0-4. Returns undefined for anything it does not fully understand —
* interlacing, sub-byte depths, truncated chunks, bad zlib — so the caller
* passes the original through instead of guessing.
*/
async function decodePng(bytes) {
	const header = readPngHeader(bytes);
	if (header === void 0) return void 0;
	const { width, height, bitDepth, colorType, interlace } = header;
	if (interlace !== 0) return void 0;
	const channels = PNG_CHANNELS[colorType];
	if (channels === void 0 || bitDepth !== 8 && bitDepth !== 16) return void 0;
	if (colorType === 3 && bitDepth !== 8) return void 0;
	if (width * height > MAX_MEGAPIXELS * 1e6) return void 0;
	const bytesPerSample = bitDepth === 16 ? 2 : 1;
	const bpp = channels * bytesPerSample;
	const rowBytes = width * bpp;
	let palette;
	let trns;
	const idat = [];
	let offset = 8;
	while (offset + 12 <= bytes.length) {
		const length = bytes.readUInt32BE(offset);
		const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
		if (!/^[A-Za-z]{4}$/.test(type) || offset + 12 + length > bytes.length) return void 0;
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		if (type === "PLTE") palette = data;
		else if (type === "tRNS") trns = data;
		else if (type === "IDAT") idat.push(data);
		else if (type === "IEND") break;
		offset += 12 + length;
	}
	if (idat.length === 0) return void 0;
	if (colorType === 3 && (palette === void 0 || palette.length === 0 || palette.length % 3 !== 0)) return void 0;
	let raw;
	try {
		const { unzlibSync } = await import("fflate");
		raw = unzlibSync(idat.length === 1 ? idat[0] : Buffer.concat(idat));
	} catch {
		return void 0;
	}
	if (raw.length !== height * (rowBytes + 1)) return void 0;
	if (!unfilterPng(raw, height, rowBytes, bpp)) return void 0;
	return rgbaFromPng(raw, width, height, channels, bytesPerSample, colorType, palette, trns);
}
/**
* Reverse one PNG's per-row filters (types 0-4) in place; false on an unknown filter.
*/
function unfilterPng(raw, height, rowBytes, bpp) {
	let previous = -1;
	for (let y = 0; y < height; y++) {
		const start = y * (rowBytes + 1);
		const filterType = raw[start];
		if (filterType > 4) return false;
		const row = start + 1;
		for (let i = 0; i < rowBytes; i++) {
			const left = i >= bpp ? raw[row + i - bpp] : 0;
			const above = previous >= 0 ? raw[previous + 1 + i] : 0;
			const upperLeft = i >= bpp && previous >= 0 ? raw[previous + 1 + i - bpp] : 0;
			let predictor = 0;
			if (filterType === 1) predictor = left;
			else if (filterType === 2) predictor = above;
			else if (filterType === 3) predictor = (left + above) >> 1;
			else if (filterType === 4) predictor = paethPredictor(left, above, upperLeft);
			raw[row + i] = raw[row + i] + predictor;
		}
		previous = start;
	}
	return true;
}
/**
* The PNG Paeth predictor: the nearest of left/above/upper-left to their plane estimate.
*/
function paethPredictor(left, above, upperLeft) {
	const estimate = left + above - upperLeft;
	const leftDistance = Math.abs(estimate - left);
	const aboveDistance = Math.abs(estimate - above);
	const diagonalDistance = Math.abs(estimate - upperLeft);
	if (leftDistance <= aboveDistance && leftDistance <= diagonalDistance) return left;
	if (aboveDistance <= diagonalDistance) return above;
	return upperLeft;
}
/**
* Convert one unfiltered PNG bitmap to RGBA, applying the palette and tRNS transparency.
*/
function rgbaFromPng(raw, width, height, channels, bytesPerSample, colorType, palette, trns) {
	const bpp = channels * bytesPerSample;
	const rowBytes = width * bpp;
	const rgba = new Uint8Array(width * height * 4);
	const grayKey = colorType === 0 && trns !== void 0 && trns.length >= 2 ? trns[0] * 256 + trns[1] : void 0;
	const rgbKey = colorType === 2 && trns !== void 0 && trns.length >= 6 ? [trns[0] * 256 + trns[1], trns[2] * 256 + trns[3], trns[4] * 256 + trns[5]] : void 0;
	const paletteEntries = palette === void 0 ? 0 : palette.length / 3;
	for (let y = 0; y < height; y++) {
		const row = y * (rowBytes + 1) + 1;
		for (let x = 0; x < width; x++) {
			const source = row + x * bpp;
			const target = (y * width + x) * 4;
			if (colorType === 6) {
				rgba[target] = raw[source];
				rgba[target + 1] = raw[source + bytesPerSample];
				rgba[target + 2] = raw[source + bytesPerSample * 2];
				rgba[target + 3] = raw[source + bytesPerSample * 3];
			} else if (colorType === 2) {
				rgba[target] = raw[source];
				rgba[target + 1] = raw[source + bytesPerSample];
				rgba[target + 2] = raw[source + bytesPerSample * 2];
				rgba[target + 3] = rgbKey !== void 0 && sampleAt(raw, source, bytesPerSample) === rgbKey[0] && sampleAt(raw, source + bytesPerSample, bytesPerSample) === rgbKey[1] && sampleAt(raw, source + bytesPerSample * 2, bytesPerSample) === rgbKey[2] ? 0 : 255;
			} else if (colorType === 0) {
				const gray = raw[source];
				rgba[target] = gray;
				rgba[target + 1] = gray;
				rgba[target + 2] = gray;
				rgba[target + 3] = grayKey !== void 0 && sampleAt(raw, source, bytesPerSample) === grayKey ? 0 : 255;
			} else if (colorType === 4) {
				const gray = raw[source];
				rgba[target] = gray;
				rgba[target + 1] = gray;
				rgba[target + 2] = gray;
				rgba[target + 3] = raw[source + bytesPerSample];
			} else if (palette !== void 0) {
				const index = raw[source];
				if (index >= paletteEntries) return void 0;
				rgba[target] = palette[index * 3];
				rgba[target + 1] = palette[index * 3 + 1];
				rgba[target + 2] = palette[index * 3 + 2];
				rgba[target + 3] = trns !== void 0 && index < trns.length ? trns[index] : 255;
			}
		}
	}
	return { width, height, data: rgba };
}
/**
* Read one full-depth sample: the 16-bit pair, or the single 8-bit byte.
*/
function sampleAt(raw, offset, bytesPerSample) {
	return bytesPerSample === 2 ? raw[offset] * 256 + raw[offset + 1] : raw[offset];
}
/**
* Composite alpha onto a white background, in place; opaque pixels are untouched.
*/
function flattenAlphaOntoWhite(rgba) {
	for (let i = 0; i < rgba.length; i += 4) {
		const alpha = rgba[i + 3];
		if (alpha === 255) continue;
		rgba[i] = blendOverWhite(rgba[i], alpha);
		rgba[i + 1] = blendOverWhite(rgba[i + 1], alpha);
		rgba[i + 2] = blendOverWhite(rgba[i + 2], alpha);
	}
}
/**
* One source-over-white blend of a single channel.
*/
function blendOverWhite(channel, alpha) {
	return (channel * alpha + 255 * (255 - alpha) + 127) / 255 | 0;
}
/**
* Proportional target size with the longest edge clamped to MAX_EDGE.
*/
function scaledSize(width, height) {
	const scale = MAX_EDGE / Math.max(width, height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}
/**
* Bilinear resample of one RGBA bitmap to an exact target size.
*/
function resizeBilinear(source, width, height, targetWidth, targetHeight) {
	const target = new Uint8Array(targetWidth * targetHeight * 4);
	const xRatio = width / targetWidth;
	const yRatio = height / targetHeight;
	for (let ty = 0; ty < targetHeight; ty++) {
		const sy = Math.min(height - 1, Math.max(0, (ty + 0.5) * yRatio - 0.5));
		const y0 = Math.floor(sy);
		const y1 = Math.min(y0 + 1, height - 1);
		const fy = sy - y0;
		const topRow = y0 * width * 4;
		const bottomRow = y1 * width * 4;
		for (let tx = 0; tx < targetWidth; tx++) {
			const sx = Math.min(width - 1, Math.max(0, (tx + 0.5) * xRatio - 0.5));
			const x0 = Math.floor(sx);
			const x1 = Math.min(x0 + 1, width - 1);
			const fx = sx - x0;
			const topLeft = topRow + x0 * 4;
			const topRight = topRow + x1 * 4;
			const bottomLeft = bottomRow + x0 * 4;
			const bottomRight = bottomRow + x1 * 4;
			const targetOffset = (ty * targetWidth + tx) * 4;
			for (let c = 0; c < 4; c++) {
				const top = source[topLeft + c] + (source[topRight + c] - source[topLeft + c]) * fx;
				const bottom = source[bottomLeft + c] + (source[bottomRight + c] - source[bottomLeft + c]) * fx;
				target[targetOffset + c] = top + (bottom - top) * fy + 0.5 | 0;
			}
		}
	}
	return target;
}
//#endregion
//#region src/vision-client.ts
/**
* Vision HTTP client for the describe-image tool: loads one image (local path,
* http(s) URL, or a stored attachment reference), builds the endpoint request that
* matches the configured protocol style (chat-completions or responses), and reads
* back the single text answer — with a short-lifetime, capacity-capped semantic
* cache so repeat calls for the same image and prompt avoid a second round trip.
* Response bodies and error excerpts are capped before any bytes are trusted.
* @module @linxin666/dsh-tool-describe-image/vision
*/
/** Promise rejection helper shared by both response-shape extractors. */
function unexpectedShape() {
	throw new Error("describe-image: vision endpoint returned an unexpected response shape");
}
/** Narrow an unknown value to a plain, non-array object, or undefined. */
function asRecord$1(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	return value;
}
/** Whether `error` carries the attachment store not-found marker. */
function isAttachmentNotFound(error) {
	return asRecord$1(error)?.["code"] === "ATTACHMENT_NOT_FOUND";
}
/**
* Validate a model-supplied attachment reference and read its verified bytes.
* @param ctx - registrant context carrying the optional attachment service.
* @param raw - the raw JSON the model copied from an `[image attachment …]` note.
* @param signal - caller cancellation.
* @returns the verified stored bytes.
*/
async function readAttachment(ctx, raw, signal) {
	const attachments = ctx.get("attachments");
	if (attachments === void 0) throw new Error("describe-image: no attachment service is mounted; pass a file path or URL instead");
	const ref = parseImageAttachmentRef(raw);
	try {
		const stored = await attachments.readImage(ref, signal);
		return Buffer.from(stored.data);
	} catch (error) {
		if (isAttachmentNotFound(error)) throw new Error(`describe-image: attachment ${JSON.stringify(ref.attachmentId)} is no longer available`);
		throw error;
	}
}
/** Sniff the media type and reject empty or unsupported inputs. */
function toImage(bytes, source) {
	if (bytes.length === 0) throw new Error(`describe-image: image is empty: ${source}`);
	const mimeType = sniffMimeType(bytes);
	if (mimeType === void 0) throw new Error(`describe-image: unsupported image type (expected PNG, JPEG, GIF, or WebP): ${source}`);
	return {
		bytes,
		mimeType
	};
}
/** Bound-check, sniff, then compress one loaded buffer — the shared tail of every input branch. */
async function finishLoad(bytes, source, maxBytes) {
	if (bytes.length > maxBytes) throw new Error(`describe-image: image is ${bytes.length} bytes, above the ${maxBytes}-byte bound`);
	return compressIfNeeded(toImage(bytes, source));
}
/**
* Load one image from a local absolute path, an http(s) URL, a complete durable attachment
* reference, or the plugin's self-contained Markdown attachment reference, enforcing the byte
* bound before any bytes reach the vision model. Non-http(s) URL schemes are rejected.
* @param ctx - registrant context; supplies the optional attachment service.
* @param input - the model-supplied image reference.
* @param signal - caller cancellation.
* @param maxBytes - image byte bound.
* @param workspace - absolute session workspace root; local file paths must resolve inside it.
* @returns the loaded bytes and sniffed media type.
*/
async function loadImage(ctx, input, signal, maxBytes, workspace) {
	const trimmed = input.trim();
	if (trimmed.length === 0) throw new Error("describe-image: image must be a non-empty path, URL, or attachment reference");
	const markdownReference = parseMarkdownAttachmentReference(trimmed);
	if (markdownReference !== void 0) {
		const ref = markdownReference.ref ?? attachmentRefById(markdownReference.attachmentId);
		if (ref === void 0) throw new Error(ATTACHMENT_REF_GUIDANCE);
		return finishLoad(await readAttachment(ctx, JSON.stringify(ref), signal), trimmed.slice(0, 96), maxBytes);
	}
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) throw new Error("describe-image: only http(s) URLs, local file paths, and attachment references are supported");
	if (trimmed.startsWith("{") || trimmed.startsWith("[image attachment ")) return finishLoad(await readAttachment(ctx, trimmed, signal), trimmed.slice(0, 96), maxBytes);
	if (/^https?:\/\//i.test(trimmed)) {
		await assertImageUrlAllowed(trimmed);
		const response = await fetch(trimmed, {
			signal,
			redirect: "error"
		});
		if (!response.ok) throw new Error("describe-image: image URL could not be fetched");
		const declared = Number(response.headers.get("content-length"));
		if (Number.isSafeInteger(declared) && declared > maxBytes) throw new Error(`describe-image: image is ${declared} bytes, above the ${maxBytes}-byte bound`);
		return finishLoad(await readBoundedBody(response, maxBytes), trimmed, maxBytes);
	}
	const registered = attachmentRefById(trimmed);
	if (registered !== void 0) return finishLoad(await readAttachment(ctx, JSON.stringify(registered), signal), trimmed, maxBytes);
	if (!isAbsolute(trimmed)) throw new Error("describe-image: image path must be an absolute path within the session workspace");
	const absolute = resolve(trimmed);
	if (workspace === void 0 || workspace.trim().length === 0) throw new Error("describe-image: local image paths require a session workspace; use an attachment reference or an http(s) URL instead");
	let root;
	try {
		root = await realpath(workspace);
	} catch {
		throw new Error("describe-image: session workspace is not accessible");
	}
	let realPath;
	try {
		realPath = await realpath(absolute);
	} catch {
		throw new Error(`describe-image: image path not found: ${trimmed}`);
	}
	if (!isInsideWorkspace(root, realPath)) throw new Error(`describe-image: image path is outside the session workspace: ${trimmed}`);
	const info = await stat(realPath, { bigint: false });
	if (!info.isFile()) throw new Error(`describe-image: image path is not a file: ${trimmed}`);
	if (info.size > maxBytes) throw new Error(`describe-image: image is ${info.size} bytes, above the ${maxBytes}-byte bound`);
	return finishLoad(await readFile(realPath, { signal }), trimmed, maxBytes);
}
/**
* Whether one canonical path is equal to or below another canonical root. Both inputs must be
* realpath outputs, so no symlink or `..` traversal can remain and the comparison is exact.
* @param root - canonical allowed root.
* @param candidate - canonical candidate path.
* @returns whether `candidate` is `root` itself or a descendant.
*/
function isInsideWorkspace(root, candidate) {
	const rel = relative(root, candidate);
	return rel === "" || rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
/**
* Read a response body up to a byte cap, rejecting the whole response beyond it.
* @param response - the response to drain.
* @param cap - the byte bound.
* @returns the accumulated body bytes.
*/
/** Drain a response body chunk by chunk, always releasing the reader lock. */
async function drainResponse(response, onChunk) {
	if (response.body === null) return;
	const reader = response.body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (onChunk(value) === "stop") return;
		}
	} finally {
		reader.releaseLock();
	}
}
async function readBoundedBody(response, cap) {
	const chunks = [];
	let total = 0;
	await drainResponse(response, (value) => {
		const chunk = Buffer.from(value);
		total += chunk.length;
		if (total > cap) throw new Error(`describe-image: response exceeds the ${cap}-byte bound`);
		chunks.push(chunk);
	});
	return Buffer.concat(chunks);
}
/**
* Read a response body as text, truncated to a character cap (error excerpts only).
* @param response - the response to drain.
* @param cap - the character cap.
* @returns the decoded text, never longer than `cap` characters.
*/
async function readBoundedText(response, cap) {
	const decoder = new TextDecoder();
	let text = "";
	let stopped = false;
	await drainResponse(response, (value) => {
		text += decoder.decode(value, { stream: true });
		if (text.length > cap) {
			stopped = true;
			return "stop";
		}
	});
	if (!stopped) text += decoder.decode();
	return text.length > cap ? text.slice(0, cap) : text;
}
/**
* Extract the single text answer from an OpenAI-compatible chat-completions
* payload. Reasoning models (Kimi K2.x and friends) can spend the whole
* max_tokens budget on the thinking chain and leave `content` empty while the
* answer lives in `reasoning_content` (issue #637) — fall back to it instead
* of failing the call outright.
*/
function extractChatCompletionsContent(payload) {
	const root = asRecord$1(payload);
	const choices = root?.choices;
	if (root === void 0 || !Array.isArray(choices) || choices.length === 0) unexpectedShape();
	const message = asRecord$1(asRecord$1(choices[0])?.message);
	const content = message?.["content"];
	if (typeof content === "string" && content.trim().length > 0) return content;
	const reasoning = message?.["reasoning_content"];
	if (typeof reasoning === "string" && reasoning.trim().length > 0) return reasoning;
	if (Array.isArray(reasoning)) {
		const parts = reasoning.filter((item) => typeof item === "string" && item.trim().length > 0);
		if (parts.length > 0) return parts.join("\n");
	}
	throw new Error("describe-image: vision endpoint returned no text content (the model may have spent the whole output budget on reasoning; raise the max output tokens or disable thinking for this model)");
}
/** Extract the text answer from an OpenAI Responses payload: every `output_text` part of assistant messages. */
function extractResponsesContent(payload) {
	const root = asRecord$1(payload);
	const output = root?.output;
	if (root === void 0 || !Array.isArray(output)) unexpectedShape();
	const parts = [];
	for (const item of output) {
		const itemRecord = asRecord$1(item);
		if (itemRecord === void 0) continue;
		const { type, role, content } = itemRecord;
		if (type !== "message" || role !== "assistant" || !Array.isArray(content)) continue;
		for (const part of content) {
			const block = asRecord$1(part);
			if (block === void 0) continue;
			if (block.type === "output_text" && typeof block.text === "string" && block.text.trim().length > 0) parts.push(block.text);
		}
	}
	const text = parts.join("\n");
	if (text.trim().length === 0) throw new Error("describe-image: vision endpoint returned no text content");
	return text;
}
/**
* Extract the text answer from an SSE (`text/event-stream`) Responses payload.
* Relay endpoints that wrap the Responses wire API (codex-lb style backends) always
* stream — `codex.keepalive`, `response.output_text.delta`, `response.output_item.done`,
* `response.completed`, then `[DONE]` — even for a non-stream request. Delta events
* accumulate the final text; `output_item.done` carries the completed message content;
* `response.completed` may carry the standard non-stream `output` shape on endpoints
* that populate it. Deltas win when present so the text is never assembled twice.
*/
function extractResponsesStreamContent(payloadBytes) {
	const deltas = [];
	const completedParts = [];
	let completedOutput;
	for (const line of payloadBytes.toString("utf8").split("\n")) {
		if (!line.startsWith("data:")) continue;
		const data = line.slice(5).trim();
		if (data.length === 0 || data === "[DONE]") continue;
		let ev;
		try {
			ev = JSON.parse(data);
		} catch {
			continue;
		}
		const record = asRecord$1(ev);
		if (record === void 0) continue;
		if (record.type === "response.output_text.delta" && typeof record.delta === "string" && record.delta.length > 0) deltas.push(record.delta);
		else if (record.type === "response.output_item.done") {
			const item = asRecord$1(record.item);
			if (item?.type === "message" && Array.isArray(item.content)) for (const part of item.content) {
				const block = asRecord$1(part);
				if (block?.type === "output_text" && typeof block.text === "string" && block.text.trim().length > 0) completedParts.push(block.text);
			}
		} else if (record.type === "response.completed" && record.response !== void 0) completedOutput = record.response;
	}
	if (deltas.length > 0) {
		const deltaText = deltas.join("");
		if (deltaText.trim().length > 0) return deltaText;
	}
	if (completedParts.length > 0) return completedParts.join("\n");
	if (completedOutput !== void 0) return extractResponsesContent(completedOutput);
	throw new Error("describe-image: vision endpoint returned no text content (SSE stream)");
}
/** Extract the text answer from an Anthropic Messages payload: every `text` content block of the top-level `content` array, skipping `thinking` and other non-text blocks. */
function extractAnthropicMessagesContent(payload) {
	const root = asRecord$1(payload);
	const content = root?.content;
	if (root === void 0 || !Array.isArray(content)) unexpectedShape();
	const parts = [];
	for (const item of content) {
		const block = asRecord$1(item);
		if (block === void 0) continue;
		if (block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0) parts.push(block.text);
	}
	const text = parts.join("\n");
	if (text.trim().length === 0) throw new Error("describe-image: vision endpoint returned no text content");
	return text;
}
/**
* Build the request the configured style sends: its path and JSON body. When the model id carried
* a thinking suffix, Chat Completions maps it to `thinking.type` (`off` -> `disabled`, every
* other level -> `enabled`) and Responses forwards it as `reasoning.effort` (`off` ->
* `none`, levels pass through); without a suffix no thinking control is sent, so the endpoint
* keeps its own default. The `anthropic-messages` style accepts a provider root, a `/v1` API root,
* or a complete `/v1/messages` endpoint and posts an Anthropic-style body (`max_tokens`, `messages[0].content` = base64 image block + text).
*/
function buildVisionRequest(spec, prompt, image) {
	if (spec.apiStyle === "anthropic-messages") return {
		path: spec.baseURL.endsWith("/v1/messages") ? spec.baseURL : spec.baseURL.endsWith("/v1") ? `${spec.baseURL}/messages` : `${spec.baseURL}/v1/messages`,
		body: JSON.stringify({
			model: spec.model,
			max_tokens: spec.maxOutputTokens,
			messages: [{
				role: "user",
				content: [{
					type: "image",
					source: {
						type: "base64",
						media_type: image.mimeType,
						data: image.bytes.toString("base64")
					}
				}, {
					type: "text",
					text: prompt
				}]
			}]
		})
	};
	const dataUrl = `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;
	if (spec.apiStyle === "responses") return {
		path: `${spec.baseURL}/responses`,
		body: JSON.stringify({
			model: spec.model,
			max_output_tokens: spec.maxOutputTokens,
			...spec.thinking === void 0 ? {} : { reasoning: { effort: spec.thinking === "off" ? "none" : spec.thinking } },
			input: [{
				role: "user",
				content: [{
					type: "input_text",
					text: prompt
				}, {
					type: "input_image",
					image_url: dataUrl
				}]
			}]
		})
	};
	return {
		path: `${spec.baseURL}/chat/completions`,
		body: JSON.stringify({
			model: spec.model,
			max_tokens: spec.maxOutputTokens,
			...spec.thinking === void 0 ? {} : { thinking: { type: spec.thinking === "off" ? "disabled" : "enabled" } },
			messages: [{
				role: "user",
				content: [{
					type: "text",
					text: prompt
				}, {
					type: "image_url",
					image_url: { url: dataUrl }
				}]
			}]
		})
	};
}
/** Default semantic-cache lifetime for a successful vision answer, in milliseconds. */
const DEFAULT_CACHE_TTL_MS = 1e4;
/** Default upper bound on cached vision answers. */
const DEFAULT_CACHE_MAX_ENTRIES = 32;
/** Create a TTL-expiring, capacity-capped vision answer cache. */
function createVisionCache(options) {
	const ttlMs = options?.ttlMs ?? 1e4;
	const maxEntries = Math.max(1, options?.maxEntries ?? 32);
	const entries = /* @__PURE__ */ new Map();
	let hits = 0;
	let misses = 0;
	return {
		get(key) {
			const entry = entries.get(key);
			if (entry === void 0) {
				misses += 1;
				return;
			}
			if (entry.expiresAt <= Date.now()) {
				entries.delete(key);
				misses += 1;
				return;
			}
			hits += 1;
			return entry.text;
		},
		set(key, text) {
			const now = Date.now();
			for (const [k, entry] of entries) if (entry.expiresAt <= now) entries.delete(k);
			entries.set(key, {
				text,
				expiresAt: now + ttlMs
			});
			while (entries.size > maxEntries) {
				const oldest = entries.keys().next().value;
				if (oldest === void 0) break;
				entries.delete(oldest);
			}
		},
		get size() {
			return entries.size;
		},
		get hits() {
			return hits;
		},
		get misses() {
			return misses;
		},
		clear() {
			entries.clear();
		}
	};
}
/** The semantic identity of one vision request: endpoint fields plus the same image bytes and prompt. */
function semanticRequestKey(spec, prompt, image) {
	const digest = createHash("sha256").update(image.bytes).digest("hex");
	return JSON.stringify([
		spec.baseURL,
		spec.model,
		spec.maxOutputTokens,
		spec.apiStyle,
		spec.thinking,
		digest,
		image.mimeType,
		prompt
	]);
}
/** Call the configured vision endpoint and return its text answer, with short-lifetime caching for repeats. */
async function callVision(spec, apiKey, prompt, image, signal, cache) {
	if (cache !== void 0) {
		const cached = cache.get(semanticRequestKey(spec, prompt, image));
		if (cached !== void 0) return cached;
	}
	const { path, body } = buildVisionRequest(spec, prompt, image);
	const headers = spec.apiStyle === "anthropic-messages" ? {
		"content-type": "application/json",
		"x-api-key": apiKey,
		"anthropic-version": "2023-06-01"
	} : {
		"content-type": "application/json",
		authorization: `Bearer ${apiKey}`
	};
	const response = await fetch(path, {
		method: "POST",
		headers,
		body,
		redirect: "error",
		signal: AbortSignal.any([signal, AbortSignal.timeout(spec.timeoutMs)])
	});
	if (!response.ok) {
		const excerpt = await readBoundedText(response, 200);
		throw new Error(`describe-image: vision endpoint returned HTTP ${response.status}: ${excerpt}`);
	}
	const payloadBytes = await readBoundedBody(response, spec.apiStyle === "responses" ? spec.maxOutputTokens * 16 + 256 * 1024 : spec.maxOutputTokens * 8 + 64 * 1024);
	let payload;
	let useStream = false;
	const contentType = response.headers.get("content-type") ?? "";
	if (spec.apiStyle === "responses" && contentType.includes("text/event-stream")) useStream = true;
	else try {
		payload = JSON.parse(payloadBytes.toString("utf8"));
	} catch {
		if (spec.apiStyle === "responses") useStream = true;
		else throw new Error("describe-image: vision endpoint returned invalid JSON");
	}
	const text = useStream ? extractResponsesStreamContent(payloadBytes) : spec.apiStyle === "responses" ? extractResponsesContent(payload) : spec.apiStyle === "anthropic-messages" ? extractAnthropicMessagesContent(payload) : extractChatCompletionsContent(payload);
	if (cache !== void 0) cache.set(semanticRequestKey(spec, prompt, image), text);
	return text;
}
//#endregion
//#region src/config-resolve.ts
/** Environment-variable name the API key resolves through when no inline key is configured. */
const DEFAULT_API_KEY_ENV = "VISION_API_KEY";
/** Per-call output-token cap sent to the vision model. */
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
/** Thinking-level suffixes accepted after the model id: `:off` disables thinking, the rest enable it. */
const THINKING_SUFFIXES = [
	"off",
	"low",
	"medium",
	"high"
];
/** Per-call vision request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 12e4;
/** Protocol styles the tool can speak to the configured endpoint. */
const API_STYLES = [
	"chat-completions",
	"responses",
	"anthropic-messages"
];
/** Protocol style used unless the configuration overrides it. */
const DEFAULT_API_STYLE = "chat-completions";
/** Whether conversation image references upgrade into inline thumbnails unless configured otherwise. */
const DEFAULT_RENDER_IMAGE_PREVIEW = true;
/** Whether image-bearing sends are rewritten into describe-image references at submit (issue #301). */
const DEFAULT_INTERCEPT_IMAGE_SEND = true;
/** Instruction sent when the model does not pass its own prompt. */
const DEFAULT_PROMPT = "Analyze this image: describe what is visible factually, transcribe legible text verbatim, and call out layout, notable details, or anything anomalous.";
/**
* Split a model id into the id the endpoint receives and its thinking-level suffix. A trailing
* `:off` / `:low` / `:medium` / `:high` is the plugin's shorthand for the thinking control:
* the suffix never reaches the endpoint, and a model id without one (or with any other suffix) is
* forwarded verbatim with no thinking control.
* @param model - the raw configured model id.
* @returns the cleaned id and the parsed level, if any.
*/
function splitModelSuffix(model) {
	const trimmed = model.trim();
	const match = /:(off|low|medium|high)$/.exec(trimmed);
	if (match === null) return {
		model: trimmed,
		thinking: void 0
	};
	return {
		model: trimmed.slice(0, -match[0].length),
		thinking: match[1]
	};
}
/** Schemastery configuration for the describe-image tool; doubles as the `describe-image` settings-section schema. */
const Config = z.object({
	baseURL: z.string(),
	model: z.string(),
	apiKey: z.string().role("secret"),
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	defaultPrompt: z.string().default(DEFAULT_PROMPT),
	maxBytes: z.number().step(1).min(1).default(DEFAULT_MAX_BYTES),
	maxOutputTokens: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_TOKENS),
	timeoutMs: z.number().min(1).default(DEFAULT_TIMEOUT_MS),
	apiStyle: z.union(API_STYLES).default(DEFAULT_API_STYLE),
	renderImagePreview: z.boolean().default(true),
	interceptImageSend: z.boolean().default(true)
});
/** Settings namespace carrying the endpoint, model, and key reference the Plugins card edits. */
const DESCRIBE_IMAGE_SETTINGS_NAMESPACE = settingsNamespace("describe-image");
/**
* Resolve raw config into validated connection facts. Programmatic construction may bypass
* Schemastery normalization, so every default and bound is re-judged here; a non-empty composition
* entry is validated at load so misconfiguration fails loud (an unconfigured family mount only
* hits it per call, inside {@link apply}).
* @param config - raw plugin config.
* @returns validated facts.
*/
function resolveConfig(config) {
	const baseURL = (config.baseURL ?? "").trim().replace(/\/+$/, "");
	if (!/^https?:\/\//.test(baseURL)) throw new Error("describe-image: baseURL must be an absolute http(s) URL");
	const { model, thinking } = splitModelSuffix(config.model ?? "");
	if (model.length === 0) throw new Error("describe-image: model must be a non-empty model id before any :off/:low/:medium/:high suffix");
	const apiKey = config.apiKey;
	if (apiKey !== void 0 && apiKey.length === 0) throw new Error("describe-image: apiKey must be non-empty when set");
	let apiKeyEnv;
	const rawEnv = config.apiKeyEnv ?? "VISION_API_KEY";
	if (rawEnv.length > 0) try {
		apiKeyEnv = credentialRef(rawEnv);
	} catch {
		throw new Error(`describe-image: apiKeyEnv ${JSON.stringify(rawEnv)} is not a valid environment-variable name`);
	}
	const maxBytes = config.maxBytes ?? 10485760;
	const maxOutputTokens = config.maxOutputTokens ?? 1024;
	const timeoutMs = config.timeoutMs ?? 12e4;
	const apiStyle = config.apiStyle ?? "chat-completions";
	for (const [field, value] of [
		["maxBytes", maxBytes],
		["maxOutputTokens", maxOutputTokens],
		["timeoutMs", timeoutMs]
	]) if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`describe-image: ${field} must be a positive safe integer`);
	if (!API_STYLES.includes(apiStyle)) throw new Error(`describe-image: apiStyle must be one of ${API_STYLES.map((style) => JSON.stringify(style)).join(", ")}`);
	return {
		baseURL,
		model,
		apiKey,
		apiKeyEnv,
		defaultPrompt: config.defaultPrompt ?? "Analyze this image: describe what is visible factually, transcribe legible text verbatim, and call out layout, notable details, or anything anomalous.",
		maxBytes,
		maxOutputTokens,
		timeoutMs,
		apiStyle,
		thinking,
		renderImagePreview: config.renderImagePreview ?? true,
		interceptImageSend: config.interceptImageSend ?? true
	};
}
/**
* Resolve the API key for one call: an explicit inline key wins; otherwise the credential seam (which owns
* environment and managed-store layers) resolves the reference; without the seam the launch environment is
* the whole credential plane.
* @param ctx - registrant context.
* @param spec - validated configuration.
* @returns the resolved key.
*/
async function resolveApiKey(ctx, spec) {
	if (spec.apiKey !== void 0) return spec.apiKey;
	if (spec.apiKeyEnv !== void 0) {
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) {
			const hit = await credentials.resolve(spec.apiKeyEnv);
			if (hit !== void 0) return hit.value;
		} else {
			const ambient = launchEnvironmentOf(ctx).get(spec.apiKeyEnv);
			if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;
		}
	}
	throw new Error(`describe-image: no API key; set apiKey, store ${spec.apiKeyEnv ?? "VISION_API_KEY"} through the credentials service, or export it in the launching environment`);
}
//#endregion
//#region src/model-probe.ts
/**
* Endpoint model probe for the describe-image tool: lists the models a
* configured vision endpoint serves, doubling as the connectivity and
* credential check the settings card's probe button runs. A successful list
* proves the endpoint is reachable and the key authenticates; no completion
* call is made, so the probe never spends tokens. The key stays on the host —
* the browser half only reads the returned id list.
* @module @linxin666/dsh-tool-describe-image/model-probe
*/
/** Probe request timeout: model listings are light, far shorter than a vision call. */
const PROBE_TIMEOUT_MS = 15e3;
/**
* Combine the optional caller signal with the probe timeout. AbortSignal.any
* of an empty array yields a signal that never aborts, so the timeout must
* stand alone when no caller signal exists — otherwise a hung upstream would
* pin the card on "testing" forever.
*/
function withTimeout(signal) {
	const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS);
	return signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
}
/** Response-body byte cap for one model listing. */
const PROBE_MAX_BODY_BYTES = 512 * 1024;
/** Model ids returned to the card; beyond this the tail of the listing is dropped. */
const PROBE_MAX_MODELS = 256;
/**
* Placeholder model id pinned when none is configured yet: the probe lists
* models precisely so the user can pick one, so an absent model must not
* block it. The listing request never sends a model id anywhere (the probe
* makes no completion call); vision calls keep the strict non-empty check.
*/
const PROBE_MODEL_PLACEHOLDER = "probe";
/** Narrow an unknown value to a plain, non-array object, or undefined. */
function asRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	return value;
}
/**
* The models-listing URL one style hits. The `anthropic-messages` style
* mirrors the completion-path rule: a provider root gains `/v1/models`, a
* `/v1` API root gains `/models`, and a complete `/v1/messages` endpoint is
* rewritten to its sibling. The OpenAI-compatible styles append `/models` to
* the configured root.
* @param baseURL - the resolved endpoint root (no trailing slash).
* @param apiStyle - the protocol style the card is configured for.
* @returns the absolute listing URL.
*/
function buildModelsUrl(baseURL, apiStyle) {
	if (apiStyle === "anthropic-messages") {
		if (baseURL.endsWith("/v1/messages")) return `${baseURL.slice(0, -9)}/models`;
		if (baseURL.endsWith("/v1")) return `${baseURL}/models`;
		return `${baseURL}/v1/models`;
	}
	return `${baseURL}/models`;
}
/**
* Extract the model ids from one listing payload. Both the OpenAI shape
* (`data[].id`) and the Anthropic shape (`data[].id` under a `/v1/models`
* envelope) carry the id the same way; entries without a non-empty string id
* are skipped rather than surfaced as blanks.
* @param payload - the parsed listing body.
* @returns the ids in listing order, capped at {@link PROBE_MAX_MODELS}.
*/
function extractModelIds(payload) {
	const data = asRecord(payload)?.["data"];
	if (!Array.isArray(data)) throw new Error("describe-image: models endpoint returned an unexpected shape");
	const ids = [];
	for (const entry of data) {
		const id = asRecord(entry)?.["id"];
		if (typeof id === "string" && id.trim().length > 0) {
			ids.push(id);
			if (ids.length >= 256) break;
		}
	}
	return ids;
}
/**
* List the models one resolved configuration's endpoint serves. Throws with a
* prefixed message on every failure, so the route envelopes one reason the
* card can surface verbatim.
* @param spec - the resolved configuration to probe.
* @param apiKey - the credential the listing authenticates with.
* @param signal - caller cancellation.
* @returns the served model ids; an empty list is its own failure.
*/
async function probeModels(spec, apiKey, signal) {
	const headers = spec.apiStyle === "anthropic-messages" ? {
		"x-api-key": apiKey,
		"anthropic-version": "2023-06-01"
	} : { authorization: `Bearer ${apiKey}` };
	let response;
	try {
		response = await fetch(buildModelsUrl(spec.baseURL, spec.apiStyle), {
			method: "GET",
			headers,
			redirect: "error",
			signal: withTimeout(signal)
		});
	} catch (error) {
		throw new Error(`describe-image: endpoint unreachable: ${error.message ?? String(error)}`);
	}
	if (!response.ok) {
		const reason = response.status === 401 || response.status === 403 ? " (key rejected)" : "";
		throw new Error(`describe-image: models endpoint returned HTTP ${response.status}${reason}`);
	}
	const body = await readBoundedBody(response, PROBE_MAX_BODY_BYTES);
	let payload;
	try {
		payload = JSON.parse(body.toString("utf8"));
	} catch {
		throw new Error("describe-image: models endpoint returned invalid JSON");
	}
	const models = extractModelIds(payload);
	if (models.length === 0) throw new Error("describe-image: endpoint listed no models");
	return models;
}
/**
* The request one model ping sends: the style's completion path with a
* minimal body (`max_tokens` 1, one short text message), so the round trip
* exercises the configured model itself — not just the models listing —
* while spending a single token of output.
* @param spec - the resolved configuration under test.
* @returns the absolute ping URL and its JSON body.
*/
function buildModelPingRequest(spec) {
	if (spec.apiStyle === "anthropic-messages") return {
		path: spec.baseURL.endsWith("/v1/messages") ? spec.baseURL : spec.baseURL.endsWith("/v1") ? `${spec.baseURL}/messages` : `${spec.baseURL}/v1/messages`,
		body: JSON.stringify({
			model: spec.model,
			max_tokens: 1,
			messages: [{
				role: "user",
				content: "ping"
			}]
		})
	};
	if (spec.apiStyle === "responses") return {
		path: `${spec.baseURL}/responses`,
		body: JSON.stringify({
			model: spec.model,
			max_output_tokens: 1,
			input: "ping"
		})
	};
	return {
		path: `${spec.baseURL}/chat/completions`,
		body: JSON.stringify({
			model: spec.model,
			max_tokens: 1,
			messages: [{
				role: "user",
				content: "ping"
			}]
		})
	};
}
/**
* Ping the configured model once and return the round-trip milliseconds.
* The completion reply is drained, never parsed: a 2xx proves the endpoint
* routed the model and answered; every failure throws with a prefixed
* message the route envelopes.
* @param spec - the resolved configuration under test.
* @param apiKey - the credential the ping authenticates with.
* @param signal - caller cancellation.
* @returns the ping's round-trip milliseconds.
*/
async function testModelConnection(spec, apiKey, signal) {
	const { path, body } = buildModelPingRequest(spec);
	const headers = spec.apiStyle === "anthropic-messages" ? {
		"content-type": "application/json",
		"x-api-key": apiKey,
		"anthropic-version": "2023-06-01"
	} : {
		"content-type": "application/json",
		authorization: `Bearer ${apiKey}`
	};
	const started = Date.now();
	let response;
	try {
		response = await fetch(path, {
			method: "POST",
			headers,
			body,
			redirect: "error",
			signal: withTimeout(signal)
		});
	} catch (error) {
		throw new Error(`describe-image: endpoint unreachable: ${error.message ?? String(error)}`);
	}
	if (!response.ok) {
		const reason = response.status === 401 || response.status === 403 ? " (key rejected)" : response.status === 404 ? " (model not found)" : "";
		throw new Error(`describe-image: model ping returned HTTP ${response.status}${reason}`);
	}
	await readBoundedBody(response, PROBE_MAX_BODY_BYTES);
	return Math.max(1, Date.now() - started);
}
/**
* Ping the model named by the merged configuration. Unlike the listing, the
* test requires a model: the overrides carry the card's model draft along
* with the connection fields, and an absent model is a rejection the card
* surfaces instead of a silent no-op.
* @param stored - the settings currently in effect.
* @param overrides - unsaved drafts from the card (non-string values ignored).
* @param resolveKey - the credential resolver for the final configuration.
* @param signal - caller cancellation.
* @returns the latency, or the structured failure.
*/
async function handleModelTest(stored, overrides, resolveKey, signal) {
	const candidate = { ...stored };
	const baseURL = overrides["baseURL"];
	const apiStyle = overrides["apiStyle"];
	const draftKey = overrides["apiKey"];
	const model = overrides["model"];
	if (typeof baseURL === "string" && baseURL.trim().length > 0) candidate.baseURL = baseURL;
	if (typeof apiStyle === "string" && apiStyle.trim().length > 0) candidate.apiStyle = apiStyle;
	if (typeof model === "string" && model.trim().length > 0) candidate.model = model;
	if (typeof draftKey === "string" && draftKey.trim().length > 0) candidate.apiKey = draftKey;
	if (typeof candidate.model !== "string" || candidate.model.trim() === "") return {
		ok: false,
		error: {
			code: "rejected",
			message: "describe-image: pick a model before testing connectivity"
		}
	};
	let spec;
	try {
		spec = resolveConfig(candidate);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "rejected",
				message: error.message
			}
		};
	}
	let resolvedKey;
	try {
		resolvedKey = await resolveKey(spec);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "rejected",
				message: error.message
			}
		};
	}
	try {
		return {
			ok: true,
			latencyMs: await testModelConnection(spec, resolvedKey, signal)
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "internal",
				message: error.message
			}
		};
	}
}
/**
* Run one model probe against a candidate configuration. The overrides carry
* the settings card's unsaved drafts so the user can verify an endpoint
* before saving; absent fields fall back to the stored settings. An empty
* draft key means "keep the current key": the stored inline key is dropped
* so the credential seam re-resolves, matching how a vision call resolves
* its key. Only the connection fields a probe can change are honored; every
* other draft stays with the stored settings.
* @param stored - the settings currently in effect.
* @param overrides - unsaved drafts from the card (non-string values ignored).
* @param resolveKey - the credential resolver for the final configuration.
* @param signal - caller cancellation.
* @returns the listing, or the structured failure.
*/
async function handleModelProbe(stored, overrides, resolveKey, signal) {
	const candidate = { ...stored };
	const baseURL = overrides["baseURL"];
	const apiStyle = overrides["apiStyle"];
	const draftKey = overrides["apiKey"];
	if (typeof baseURL === "string" && baseURL.trim().length > 0) candidate.baseURL = baseURL;
	if (typeof apiStyle === "string" && apiStyle.trim().length > 0) candidate.apiStyle = apiStyle;
	if (typeof draftKey === "string" && draftKey.trim().length > 0) candidate.apiKey = draftKey;
	if (typeof candidate.model !== "string" || candidate.model.trim() === "") candidate.model = PROBE_MODEL_PLACEHOLDER;
	let spec;
	try {
		spec = resolveConfig(candidate);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "rejected",
				message: error.message
			}
		};
	}
	let resolvedKey;
	try {
		resolvedKey = await resolveKey(spec);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "rejected",
				message: error.message
			}
		};
	}
	try {
		return {
			ok: true,
			models: await probeModels(spec, resolvedKey, signal)
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "internal",
				message: error.message
			}
		};
	}
}
//#endregion
//#region src/http.ts
/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Lenient bounded body reader: parse a request body as JSON, or null on an
* empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
* Overflow destroys the request instead of draining the remainder (no drain
* call, matching the current repo-wide behavior); callers must not keep
* reading the request afterwards. With objectOnly, non-JSON-object payloads
* also yield null.
*/
async function readJsonBody(req, opts = {}) {
	const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		const parsed = JSON.parse(text);
		if (opts.objectOnly && !isJsonObject(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
/** Whether a value is a JSON object: typeof object, not null, not an array. */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
//#endregion
//#region src/attach-routes.ts
/**
* JSON request-body cap for one attach: base64 of a `maxBytes` image
* inflates to ~4/3 its byte length, plus JSON envelope slack. Scaling it with
* the configured image bound (not a fixed 16 MiB) keeps a higher configured
* maxBytes usable — a fixed cap silently rejected any image whose base64
* exceeded it.
*/
function attachBodyCap(maxBytes) {
	return Math.ceil(maxBytes / 3) * 4 + 1024;
}
/** The failure envelope used when a non-POST request hits the route. */
const METHOD_NOT_ALLOWED = {
	code: "internal",
	message: "only POST is allowed"
};
/**
* In-memory fallback for callers that copied only a bare attachment id instead
* of the complete durable Markdown or note. The attachment store still verifies
* the digest on every read. Bounded FIFO; ids are content-addressed so a stale
* entry cannot be confused with another image.
*/
const ATTACHMENT_REF_REGISTRY = /* @__PURE__ */ new Map();
/** Registry capacity; beyond it the oldest entry is dropped. */
const ATTACHMENT_REF_REGISTRY_CAP = 128;
/** Remember one persisted reference by its attachment id. */
function registerAttachmentRef(ref) {
	ATTACHMENT_REF_REGISTRY.delete(ref.attachmentId);
	ATTACHMENT_REF_REGISTRY.set(ref.attachmentId, ref);
	while (ATTACHMENT_REF_REGISTRY.size > ATTACHMENT_REF_REGISTRY_CAP) {
		const oldest = ATTACHMENT_REF_REGISTRY.keys().next().value;
		if (oldest === void 0) break;
		ATTACHMENT_REF_REGISTRY.delete(oldest);
	}
}
/** Look up a persisted reference by its bare attachment id, if still in the registry. */
/** decodeURIComponent that returns null instead of throwing on malformed input. */
function safeDecodeUriComponent(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}
function attachmentRefById(id) {
	return ATTACHMENT_REF_REGISTRY.get(id);
}
/** Build the `[image attachment …]` note text for one reference. */
function attachmentNote(ref) {
	return `[image attachment ${JSON.stringify(ref)}]`;
}
/**
* Validate an unknown upload payload and decode its bytes. Pure: no context,
* no I/O — every rejection reason is spelled in the error message.
* @param payload - the parsed request body.
* @param maxBytes - the image byte bound.
* @returns the validated payload and decoded bytes, or the rejection.
*/
function validateAttachPayload(payload, maxBytes) {
	if (typeof payload !== "object" || payload === null) return { error: {
		code: "internal",
		message: "request body must be a JSON object"
	} };
	const { data, mediaType, name } = payload;
	if (typeof data !== "string" || data.length === 0) return { error: {
		code: "rejected",
		message: "image data must be a non-empty base64 string"
	} };
	if (!isImageMimeType(mediaType)) return { error: {
		code: "rejected",
		message: "mediaType must be one of image/png, image/jpeg, image/gif, image/webp"
	} };
	if (name !== void 0 && (typeof name !== "string" || name.length === 0)) return { error: {
		code: "rejected",
		message: "name must be a non-empty string when present"
	} };
	const bytes = decodeBase64(data);
	if (bytes === void 0) return { error: {
		code: "rejected",
		message: "image data is not valid base64"
	} };
	if (bytes.length === 0) return { error: {
		code: "rejected",
		message: "image data is empty"
	} };
	if (bytes.length > maxBytes) return { error: {
		code: "rejected",
		message: `image is ${bytes.length} bytes, above the ${maxBytes}-byte bound`
	} };
	if (sniffMimeType(bytes) !== mediaType) return { error: {
		code: "rejected",
		message: `bytes do not match the declared ${mediaType} type`
	} };
	return {
		payload: {
			data,
			mediaType,
			name
		},
		bytes
	};
}
/**
* Validate and persist one upload. The declared media type is checked against
* magic bytes before any store write; the store's own validation runs before
* the reference is published.
* @param ctx - registrant context carrying the optional attachment service.
* @param maxBytes - the image byte bound.
* @param payload - the parsed request body.
* @returns the stored reference and its note text, or a structured rejection.
*/
async function handleAttach(ctx, maxBytes, payload) {
	const validated = validateAttachPayload(payload, maxBytes);
	if ("error" in validated) return {
		ok: false,
		error: validated.error
	};
	const attachments = ctx.get("attachments");
	if (attachments === void 0) return {
		ok: false,
		error: {
			code: "internal",
			message: "the attachment service is not mounted; the route cannot store images"
		}
	};
	try {
		const ref = await attachments.saveImage({
			data: validated.bytes,
			mediaType: validated.payload.mediaType,
			...validated.payload.name === void 0 ? {} : { name: validated.payload.name }
		});
		registerAttachmentRef(ref);
		return {
			ok: true,
			ref,
			note: attachmentNote(ref),
			markdown: attachmentMarkdown(ref)
		};
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "internal",
				message: `attachment store rejected the image: ${error.message ?? String(error)}`
			}
		};
	}
}
/**
* Answer one capability probe (GET /describe-image/capability?session=<id>):
* whether the session's effective model positively declares image input.
* The browser send hook passes raw image blocks through only on an explicit
* acceptsImages; every other answer keeps the legacy describe-image rewrite.
* @param probe - the per-mount capability probe.
* @param req - the incoming GET request.
* @param res - the outgoing response.
*/
async function serveCapability(probe, req, res) {
	const sessionId = new URL(req.url ?? "/", "http://x").searchParams.get("session") ?? "";
	writeJson(res, 200, {
		ok: true,
		value: probe === void 0 || sessionId === "" ? UNKNOWN_CAPABILITY : await probe(sessionId)
	});
}
/**
* Serve one stored image by its raw-route id. Unknown ids and store failures
* answer 404; current Markdown supplies verified reference metadata in its
* query string, while legacy id-only Markdown falls back to the process registry.
* @param ctx - registrant context carrying the optional attachment service.
* @param req - the incoming GET request.
* @param res - the outgoing response.
*/
async function serveRawImage(ctx, req, res) {
	const requestUrl = new URL(req.url ?? "/", "http://x");
	const match = /^\/describe-image\/raw\/([^/]+)$/.exec(requestUrl.pathname);
	if (match === null) {
		res.writeHead(404);
		res.end();
		return;
	}
	const id = safeDecodeUriComponent(match[1]);
	if (id === null) {
		res.writeHead(404);
		res.end();
		return;
	}
	let ref;
	const serializedRef = requestUrl.searchParams.get("ref");
	if (serializedRef !== null) {
		try {
			ref = parseImageAttachmentRef(serializedRef);
		} catch {
			res.writeHead(404);
			res.end();
			return;
		}
		if (ref.attachmentId !== id) {
			res.writeHead(404);
			res.end();
			return;
		}
	}
	ref ??= attachmentRefById(id);
	if (ref === void 0) {
		res.writeHead(404);
		res.end();
		return;
	}
	const attachments = ctx.get("attachments");
	if (attachments === void 0) {
		res.writeHead(404);
		res.end();
		return;
	}
	try {
		const stored = await attachments.readImage(ref);
		res.writeHead(200, {
			"content-type": stored.ref.mediaType,
			"content-length": String(stored.data.byteLength),
			"cache-control": "private, max-age=3600"
		});
		res.end(Buffer.from(stored.data));
	} catch {
		res.writeHead(404);
		res.end();
	}
}
/**
* Register the /describe-image/attach POST route on the shared webserver. The
* byte bound is read per request so the Settings card's maxBytes change lands
* immediately; the attachment service is resolved per call.
* @param ctx - registrant context; webServer is required.
* @param readMaxBytes - per-request byte-bound reader (defaults to the constant).
* @param probe - per-session image-input capability probe for the GET capability route.
*/
function registerAttachRoute(ctx, readMaxBytes = () => DEFAULT_MAX_BYTES, probe) {
	const webserver = ctx.get("webServer");
	if (webserver === void 0) return;
	webserver.register({
		kind: "prefix",
		path: "/describe-image",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, { error: "forbidden: loopback-only" });
				return;
			}
			if (req.method === "GET") {
				if (new URL(req.url ?? "/", "http://x").pathname === "/describe-image/capability") {
					await serveCapability(probe, req, res);
					return;
				}
				await serveRawImage(ctx, req, res);
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: METHOD_NOT_ALLOWED
				});
				return;
			}
			const maxBytes = readMaxBytes();
			const body = await readJsonBody(req, { maxBytes: attachBodyCap(maxBytes) });
			if (body === null) {
				writeJson(res, 400, {
					ok: false,
					error: {
						code: "internal",
						message: "request body must be JSON within the configured image bound"
					}
				});
				return;
			}
			const outcome = await handleAttach(ctx, maxBytes, body);
			if (outcome.ok) {
				writeJson(res, 200, {
					ok: true,
					value: {
						note: outcome.note,
						markdown: outcome.markdown,
						ref: outcome.ref
					}
				});
				return;
			}
			writeJson(res, outcome.error.code === "rejected" ? 422 : 500, {
				ok: false,
				error: outcome.error
			});
		}
	});
}
/** Request-body byte cap for the model probe: three short connection-field drafts. */
const MAX_MODEL_PROBE_BODY_BYTES = 4096;
/**
* Register the /describe-image/models POST routes on the shared webserver.
* Two actions share the prefix: the bare path lists the configured
* endpoint's models (the settings card's fetch control — a success doubles
* as the endpoint connectivity and credential check), and the /test suffix
* pings the selected model with a minimal completion so the card reports
* the model's own round-trip latency. The stored settings and the key
* resolver are read per request, so the card's unsaved drafts can override
* the connection fields before any save, while the key itself never crosses
* into the browser (only the id list or the latency comes back).
* @param ctx - registrant context; webServer is required.
* @param readConfig - per-request reader of the settings currently in effect.
* @param resolveKey - the credential resolver for the final configuration.
*/
function registerModelRoutes(ctx, readConfig, resolveKey) {
	const webserver = ctx.get("webServer");
	if (webserver === void 0) return;
	webserver.register({
		kind: "prefix",
		path: "/describe-image/models",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, { error: "forbidden: loopback-only" });
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: METHOD_NOT_ALLOWED
				});
				return;
			}
			const body = await readJsonBody(req, { maxBytes: MAX_MODEL_PROBE_BODY_BYTES });
			const overrides = body !== null && typeof body === "object" && !Array.isArray(body) ? body : {};
			if (new URL(req.url ?? "/", "http://x").pathname === "/describe-image/models/test") {
				const test = await handleModelTest(readConfig(), overrides, resolveKey);
				if (test.ok) {
					writeJson(res, 200, {
						ok: true,
						value: { latencyMs: test.latencyMs }
					});
					return;
				}
				writeJson(res, test.error.code === "rejected" ? 422 : 502, {
					ok: false,
					error: test.error
				});
				return;
			}
			const outcome = await handleModelProbe(readConfig(), overrides, resolveKey);
			if (outcome.ok) {
				writeJson(res, 200, {
					ok: true,
					value: { models: outcome.models }
				});
				return;
			}
			writeJson(res, outcome.error.code === "rejected" ? 422 : 502, {
				ok: false,
				error: outcome.error
			});
		}
	});
}
//#endregion
//#region src/tool-visibility.ts
/** The model-facing tool name this controller masks. */
const DESCRIBE_IMAGE_TOOL = "describe_image";
/** The settings namespace the wire's session.selectModel persists into. */
const AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE = "agent-default-model";
/** The session's resting route: its logged request config, else the default selection. */
function restingRoute(ctx, agent) {
	const logged = agent.session?.requestHeader?.()?.config;
	if (typeof logged?.provider === "string" && logged.provider !== "" && typeof logged.model === "string" && logged.model !== "") return {
		provider: logged.provider,
		model: logged.model
	};
	const fallback = optionalService(ctx, "agentDefaultModel")?.currentSelection();
	if (typeof fallback?.provider === "string" && fallback.provider !== "" && typeof fallback.model === "string" && fallback.model !== "") return {
		provider: fallback.provider,
		model: fallback.model
	};
}
/**
* Install the per-session tool-visibility controller. Multimodal sessions
* have describe_image masked from their toolset; every other session keeps
* the tool. The mask follows the shared route verdict: applied at
* agent/created (so a fresh or resumed session is right from its first
* request), re-applied on every agent/request (the exact route of the
* running request), and re-evaluated on agent-default-model changes (a model
* picked for a fresh session must hide the tool from turn one). All
* wiring failures are contained — visibility is advisory, and the send hook
* independently guards image delivery.
* @param ctx - registrant context; the listeners unwind with the plugin.
* @param resolveRoute - shared exact-route resolver (same instance as the capability probe).
*/
function installToolVisibility(ctx, resolveRoute) {
	/** Per-agent verdict: true = session model accepts image input (tool masked). */
	const verdicts = /* @__PURE__ */ new Map();
	/** Per-agent restriction disposers: lift the mask when the verdict flips. */
	const restrictions = /* @__PURE__ */ new Map();
	const applyVerdict = (agent, acceptsImages) => {
		if (verdicts.get(agent.id) === acceptsImages) return;
		verdicts.set(agent.id, acceptsImages);
		restrictions.get(agent.id)?.();
		restrictions.delete(agent.id);
		if (!acceptsImages) return;
		const tools = agent.ctx.tools;
		if (tools?.restrict === void 0) return;
		try {
			restrictions.set(agent.id, tools.restrict({ deny: [DESCRIBE_IMAGE_TOOL] }));
		} catch {}
	};
	const clearVerdict = (agentId) => {
		verdicts.delete(agentId);
		restrictions.get(agentId)?.();
		restrictions.delete(agentId);
	};
	const evaluateResting = (agent) => {
		const route = restingRoute(ctx, agent);
		if (route === void 0) return;
		resolveRoute(route).then((capability) => applyVerdict(agent, capability.acceptsImages));
	};
	ctx.on("agent/created", ({ agent }) => {
		evaluateResting(agent);
	});
	ctx.on("agent/disposed", ({ agent }) => {
		clearVerdict(agent.id);
	});
	ctx.on("agent/request", async (payload, next) => {
		const resolved = await next();
		resolveRoute({
			provider: resolved.provider,
			model: resolved.model
		}).then((capability) => applyVerdict(payload.agent, capability.acceptsImages));
		return resolved;
	});
	ctx.on("settings/updated", (namespace) => {
		if (namespace !== AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE) return;
		const agents = optionalService(ctx, "agents");
		for (const agent of agents?.list() ?? []) evaluateResting(agent);
	});
}
//#endregion
//#region src/native-images.ts
/** The DeepSeek adapter's settings namespace. */
const LLM_DEEPSEEK_SETTINGS_NAMESPACE = settingsNamespace("llm-deepseek");
/** Resolve the adapter namespace descriptor (undefined when unregistered). */
function adapterDescriptor(settings) {
	if (settings === void 0) return void 0;
	const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === String(LLM_DEEPSEEK_SETTINGS_NAMESPACE));
	if (descriptor === void 0) return void 0;
	if (settings.writable === false) return void 0;
	return {
		value: descriptor.value,
		revision: descriptor.revision
	};
}
/** The catalogued modalities of one model, or undefined when absent. */
function cataloguedModalities(descriptor, model) {
	const value = descriptor?.value;
	const entry = (Array.isArray(value?.models) ? value.models : []).find((candidate) => candidate.id === model);
	if (entry === void 0 || !Array.isArray(entry.inputModalities)) return void 0;
	return entry.inputModalities.filter((item) => typeof item === "string");
}
/** The current agent-default route (absent when no selection exists). */
function currentRoute(ctx) {
	const selection = optionalService(ctx, "agentDefaultModel")?.currentSelection();
	if (typeof selection?.provider !== "string" || selection.provider === "" || typeof selection.model !== "string" || selection.model === "") return;
	return {
		provider: selection.provider,
		model: selection.model
	};
}
/**
* Assemble the read-only state view the browser half renders.
* @param ctx - registrant context.
* @param resolver - shared exact-route resolver (same instance as the send hook).
* @returns the state (async: the route verdict may probe the adapter).
*/
async function readNativeImageState(ctx, resolver) {
	const route = currentRoute(ctx);
	const descriptor = adapterDescriptor(optionalService(ctx, "settings"));
	const capability = route === void 0 ? UNKNOWN_CAPABILITY : await resolver(route);
	return {
		...route === void 0 ? {} : {
			provider: route.provider,
			model: route.model
		},
		capability,
		...route === void 0 ? {} : { inputModalities: cataloguedModalities(descriptor, route.model) },
		supported: descriptor !== void 0 && route !== void 0
	};
}
/**
* Toggle native image input for the current agent-default model: rewrite
* the adapter catalog entry's `inputModalities` to ["text","image"] (or
* back to ["text"]) through the official settings seam, fenced by the
* descriptor's revision so a concurrent edit fails with a conflict instead
* of clobbering it.
* @param ctx - registrant context.
* @param enabled - whether the model should accept image input natively.
* @throws on an unsupported host, a missing route, or a revision conflict.
*/
async function setNativeImageEnabled(ctx, enabled, resolver) {
	const route = currentRoute(ctx);
	if (route === void 0) throw new Error("native-images: no agent default model selection");
	const settings = optionalService(ctx, "settings");
	const descriptor = adapterDescriptor(settings);
	if (descriptor === void 0 || settings === void 0) throw new Error("native-images: the llm-deepseek settings namespace is not available");
	const value = descriptor.value;
	const models = Array.isArray(value?.models) ? value.models : [];
	const index = models.findIndex((entry) => entry.id === route.model);
	const modalities = enabled ? ["text", "image"] : ["text"];
	const next = models.map((entry) => entry);
	if (index === -1) next.push({
		id: route.model,
		inputModalities: modalities
	});
	else next[index] = {
		...next[index],
		inputModalities: modalities
	};
	await settings.mutate(LLM_DEEPSEEK_SETTINGS_NAMESPACE, [{
		op: "set",
		path: ["models"],
		value: next
	}], descriptor.revision);
	resolver?.invalidate(route);
}
function registerNativeImageRoutes(ctx, resolver) {
	const guard = (req, res) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, {
				ok: false,
				code: "forbidden",
				message: "loopback only"
			});
			return false;
		}
		return true;
	};
	return [{
		kind: "exact",
		path: "/describe-image/native-images",
		handler: async (req, res) => {
			if (!guard(req, res)) return;
			if (req.method !== "GET" && req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					code: "method-not-allowed",
					message: "method not allowed: " + (req.method ?? "")
				});
				return;
			}
			if (req.method === "GET") {
				writeJson(res, 200, {
					ok: true,
					value: await readNativeImageState(ctx, resolver)
				});
				return;
			}
			const body = await readJsonBody(req, { maxBytes: 4096 });
			if (body === null || typeof body !== "object" || typeof body.enabled !== "boolean") {
				writeJson(res, 400, {
					ok: false,
					code: "bad-request",
					message: "native-images: expected { enabled: boolean }"
				});
				return;
			}
			try {
				await setNativeImageEnabled(ctx, body.enabled, resolver);
				writeJson(res, 200, {
					ok: true,
					value: await readNativeImageState(ctx, resolver)
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				writeJson(res, /revision|conflict/i.test(message) ? 409 : 400, {
					ok: false,
					code: "settings-rejected",
					message
				});
			}
		}
	}];
}
//#endregion
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-ui-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web-ui.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and unmarks when its fiber disposes;
* any later mount of the same package name is a no-op.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/index.ts
const name = "describe-image";
const inject = ["tools", "webServer"];
/**
* Pure call view: a generic read card, with a file location for local paths.
* @param args - the validated call arguments.
* @returns the pending-state card for one describe_image call.
*/
function describeImageCallView(args) {
	return {
		card: "generic",
		title: "Describe image",
		kind: "read",
		rawInput: args,
		.../^https?:\/\//i.test(args.image) ? {} : { locations: [{ path: args.image }] }
	};
}
/**
* Register the `describe_image` tool on `ctx.tools`. The image never enters the conversation: the
* tool returns only the vision model’s text answer. The `describe-image` settings section layers
* over the composition entry and is re-resolved per call, so the Settings → 插件配置 card's changes
* reach the very next invocation. Repeat calls for the same image and prompt reuse a short-lived
* semantic cache so the endpoint is not called twice in quick succession.
*
* Family adaptation: the aggregate mounts this plugin without configuration, so endpoint/model
* validation is lazy — an empty composition entry loads fine and the first call fails with a clear
* "unconfigured" message; a non-empty entry is still validated eagerly at load and fails loud.
* @param ctx - registrant context carrying the tool registry.
* @param config - deployment configuration.
*/
const apply = mountOnce("@linxin666/dsh-tool-describe-image", applyImpl);
function applyImpl(ctx, config = {}) {
	if (config.baseURL !== void 0 || config.model !== void 0) resolveConfig(config);
	let current = () => config;
	installSettingsSection(ctx, DESCRIBE_IMAGE_SETTINGS_NAMESPACE, Config, config, {
		setSource: (source) => {
			current = source;
		},
		onChange: () => {},
		validate: (value) => {
			if (value.baseURL !== void 0 && value.model !== void 0) resolveConfig(value);
		}
	});
	const spec = () => resolveConfig(current());
	const visionCache = createVisionCache();
	const routeResolver = createRouteResolver(ctx);
	const probe = createCapabilityProbe(ctx, routeResolver);
	installToolVisibility(ctx, routeResolver);
	registerAttachRoute(ctx, () => current().maxBytes ?? 10485760, probe);
	const webserver = ctx.get("webServer");
	if (webserver !== void 0) for (const route of registerNativeImageRoutes(ctx, routeResolver)) webserver.register(route);
	registerModelRoutes(ctx, () => current(), (spec) => resolveApiKey(ctx, spec));
	ctx.tools.register(defineTool({
		name: "describe_image",
		description: "Inspect one image — a local absolute path inside the session workspace, an http(s) URL, a complete `[image attachment ...]` note, or a self-contained Markdown attachment reference — and return the text the user needs. Use when the user references an image file or URL, or when a task needs OCR, chart or diagram reading, screenshot or UI analysis, translation of image text, or photo understanding. Always pass an explicit `prompt` with a precise instruction — e.g. \"transcribe all text\", \"extract the table as CSV\", \"diagnose the UI layout problems\", \"translate the text into Chinese\" — instead of leaving it to the default description: a targeted instruction produces a much more useful answer. If your model accepts image input directly, never call this tool for an image that is already visible to you in the conversation — analyze it with your own vision — and prefer a native image-reading tool (when one is available to you) for local image files. Reserve this tool for images you cannot see: http(s) URLs, `[image attachment …]` notes, or when your model lacks image input entirely. The image may be a local path, an http(s) URL, a complete `[image attachment ...]` note, or — the common case when the user used this plugin's input-box image button — the complete Markdown image reference like `![图片](/describe-image/raw/sha256:abc?ref=...)` pasted into the conversation. Pass that complete Markdown reference as the `image` value: it carries the durable attachment metadata needed after a host restart or inside a PTC nested tool call. A bare attachment id stays supported only while this host process has seen the upload. The image itself never enters the conversation — only the returned text is shown to you.",
		parameters: {
			image: {
				type: "string",
				required: true,
				description: "Absolute local image path inside the session workspace, http(s) URL, complete [image attachment ...] note, or complete Markdown reference ![图片](/describe-image/raw/<id>?ref=...) from the input box. The complete Markdown reference is durable across host restarts and PTC nested tool calls; a bare attachment id is only a current-process fallback."
			},
			prompt: {
				type: "string",
				description: "Your precise instruction for the vision model about this image (e.g. \"transcribe all text\", \"extract the table as CSV\", \"diagnose the UI problems\", \"translate the text\"). Prefer a targeted prompt over the generic default description."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: {
						type: "string",
						required: true
					},
					model: {
						type: "string",
						required: true
					},
					image: {
						type: "string",
						required: true
					},
					mimeType: {
						type: "string",
						required: true,
						enum: [
							"image/png",
							"image/jpeg",
							"image/gif",
							"image/webp"
						]
					},
					bytes: {
						type: "integer",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}]
		},
		async execute(args, exec) {
			const active = spec();
			const apiKey = await resolveApiKey(ctx, active);
			const image = await loadImage(ctx, args.image, exec.signal, active.maxBytes, exec.agent?.session.header.cwd);
			return {
				text: await callVision(active, apiKey, args.prompt ?? active.defaultPrompt, image, exec.signal, visionCache),
				model: active.model,
				image: args.image,
				mimeType: image.mimeType,
				bytes: image.bytes.length
			};
		},
		presentCall: describeImageCallView
	}));
}
//#endregion
export { API_STYLES, Config, DEFAULT_API_KEY_ENV, DEFAULT_API_STYLE, DEFAULT_CACHE_MAX_ENTRIES, DEFAULT_CACHE_TTL_MS, DEFAULT_INTERCEPT_IMAGE_SEND, DEFAULT_MAX_BYTES, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_PROMPT, DEFAULT_RENDER_IMAGE_PREVIEW, DEFAULT_TIMEOUT_MS, DESCRIBE_IMAGE_SETTINGS_NAMESPACE, PROBE_MAX_BODY_BYTES, PROBE_MAX_MODELS, PROBE_MODEL_PLACEHOLDER, PROBE_TIMEOUT_MS, THINKING_SUFFIXES, apply, buildModelPingRequest, buildModelsUrl, callVision, createVisionCache, describeImageCallView, extractChatCompletionsContent, extractModelIds, extractResponsesContent, handleModelProbe, handleModelTest, inject, loadImage, name, parseImageAttachmentRef, probeModels, readAttachment, readBoundedBody, readBoundedText, resolveApiKey, resolveConfig, semanticRequestKey, sniffMimeType, splitModelSuffix, testModelConnection };
