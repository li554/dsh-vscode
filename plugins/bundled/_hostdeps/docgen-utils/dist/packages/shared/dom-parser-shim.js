/**
 * DOMParser shim for Node.js using linkedom.
 * Import this file to polyfill DOMParser, Node, and Element in Node.js environment.
 *
 * Note: linkedom's XML parsing returns localName with namespace prefix (e.g., "w:p"),
 * but browser's native DOMParser returns localName without prefix (e.g., "p").
 * This shim wraps linkedom's DOMParser to fix this behavior for XML documents.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DOMParser as LinkedomDOMParser, parseHTML } from "linkedom";
// Get the Element class from linkedom by checking the prototype
const { document: tempDoc } = parseHTML("<div></div>");
const tempElement = tempDoc.querySelector("div");
const ElementClass = Object.getPrototypeOf(tempElement).constructor;
/**
 * Store original tagName for getElementsByTagName lookups.
 * Maps element -> original prefixed tagName (e.g., "w:p")
 */
const originalTagNames = new WeakMap();
/**
 * Wrapper around linkedom's DOMParser that fixes localName for XML documents.
 * In XML mode, linkedom sets localName to include the prefix (e.g., "w:p"),
 * but browsers set localName to just the local part (e.g., "p").
 */
class DOMParserShim {
    parseFromString(markup, mimeType) {
        const parser = new LinkedomDOMParser();
        const doc = parser.parseFromString(markup, mimeType);
        // For XML documents, fix the localName property on all elements
        if (mimeType === "text/xml" || mimeType === "application/xml") {
            fixLocalNames(doc.documentElement);
            // Patch getElementsByTagName to support both prefixed and unprefixed queries
            patchGetElementsByTagName(doc);
        }
        return doc;
    }
}
/**
 * Recursively fix localName on all elements in the tree.
 * Converts "w:p" -> "p", "w:body" -> "body", etc.
 * Preserves original tagName for getElementsByTagName lookups.
 */
function fixLocalNames(element) {
    if (!element)
        return;
    // Fix this element's localName by removing namespace prefix
    const currentLocalName = element.localName;
    if (currentLocalName && currentLocalName.includes(":")) {
        // Store original tagName for getElementsByTagName
        originalTagNames.set(element, currentLocalName);
        const [prefix, localPart] = currentLocalName.split(":");
        // Override the localName property
        Object.defineProperty(element, "localName", {
            value: localPart,
            writable: true,
            configurable: true,
        });
        // Set prefix property to match browser behavior
        Object.defineProperty(element, "prefix", {
            value: prefix,
            writable: true,
            configurable: true,
        });
    }
    // Recursively fix children
    const children = element.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            fixLocalNames(children[i]);
        }
    }
}
/**
 * Patch getElementsByTagName on document and all elements to support
 * both prefixed queries (like "w:body") and unprefixed queries (like "body").
 */
function patchGetElementsByTagName(doc) {
    // Patch document.getElementsByTagName
    const originalDocGetElements = doc.getElementsByTagName.bind(doc);
    doc.getElementsByTagName = function (tagName) {
        // First try the original (which now uses unprefixed names)
        let results = originalDocGetElements(tagName);
        // If no results and tagName has a prefix, try matching against original tagNames
        if (results.length === 0 && tagName.includes(":")) {
            const unprefixedName = tagName.split(":")[1];
            results = originalDocGetElements(unprefixedName);
            // Filter to only elements that had the exact original prefixed tagName
            const filtered = Array.from(results).filter((el) => originalTagNames.get(el) === tagName);
            // Create a fake NodeList-like array
            return createNodeList(filtered);
        }
        return results;
    };
    // Also patch getElementsByTagName on all elements
    patchElementGetElementsByTagName(doc.documentElement);
}
/**
 * Recursively patch getElementsByTagName on element and its descendants.
 */
function patchElementGetElementsByTagName(element) {
    if (!element)
        return;
    const originalGetElements = element.getElementsByTagName?.bind(element);
    if (originalGetElements) {
        element.getElementsByTagName = function (tagName) {
            // First try the original (which now uses unprefixed names)
            let results = originalGetElements(tagName);
            // If no results and tagName has a prefix, try matching against original tagNames
            if (results.length === 0 && tagName.includes(":")) {
                const unprefixedName = tagName.split(":")[1];
                results = originalGetElements(unprefixedName);
                // Filter to only elements that had the exact original prefixed tagName
                const filtered = Array.from(results).filter((el) => originalTagNames.get(el) === tagName);
                return createNodeList(filtered);
            }
            return results;
        };
    }
    // Recursively patch children
    const children = element.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            patchElementGetElementsByTagName(children[i]);
        }
    }
}
/**
 * Create a NodeList-like object from an array of elements.
 */
function createNodeList(elements) {
    // Add item method to the array
    elements.item = (index) => elements[index] ?? null;
    return elements;
}
// Node constants for nodeType checks
const NodeShim = {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
};
// Polyfill globals
globalThis.DOMParser = DOMParserShim;
globalThis.Node = NodeShim;
globalThis.Element = ElementClass;
export { DOMParserShim as DOMParser, NodeShim as Node, ElementClass as Element };
//# sourceMappingURL=dom-parser-shim.js.map