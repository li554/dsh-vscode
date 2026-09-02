/**
 * Shared font mapping for Office document import and export.
 *
 * Single source of truth that maps font names to:
 * - CSS fallback stacks (for import: Office → HTML)
 * - Office-compatible font names (for export: HTML → Office)
 *
 * Used by packages/slides and packages/docs.
 */
// ============================================================================
// Font Map — single source of truth
// ============================================================================
/**
 * Comprehensive font map covering:
 * - Microsoft Office fonts (Calibri, Cambria, Aptos, etc.)
 * - CJK fonts (Japanese, Chinese, Korean)
 * - Google Fonts / web fonts (Inter, Montserrat, Playfair Display, etc.)
 * - GitHub Copilot fonts (Ginto)
 * - Common system/UI fonts
 * - Handwriting / decorative fonts
 * - Symbol fonts
 *
 * Keys are the canonical (case-sensitive) font names as they appear in Office
 * files or CSS. Lookup helpers normalize case as needed.
 */
export const FONT_MAP = {
    // ---- Microsoft Office fonts ----
    "Calibri": { cssFallback: "'Calibri','Carlito','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Calibri", category: "sans-serif" },
    "Calibri Light": { cssFallback: "'Calibri Light','Carlito','Helvetica Neue Light','Helvetica Neue',Arial,sans-serif", officeFont: "Calibri Light", category: "sans-serif" },
    "Cambria": { cssFallback: "'Cambria','Caladea','Times New Roman',Georgia,serif", officeFont: "Cambria", category: "serif" },
    "Cambria Math": { cssFallback: "'Cambria Math','Caladea','Times New Roman',serif", officeFont: "Cambria Math", category: "serif" },
    "Consolas": { cssFallback: "'Consolas','Courier New',monospace", officeFont: "Consolas", category: "monospace" },
    "Aptos": { cssFallback: "'Aptos','Carlito','Helvetica Neue',Arial,sans-serif", officeFont: "Aptos", category: "sans-serif" },
    "Times New Roman": { cssFallback: "'Times New Roman','Liberation Serif',Georgia,serif", officeFont: "Times New Roman", category: "serif" },
    // ---- Handwriting / decorative fonts ----
    "MV Boli": { cssFallback: "'MV Boli','Comic Sans MS','Marker Felt',cursive", officeFont: "MV Boli", category: "cursive" },
    "Kristen ITC": { cssFallback: "'Kristen ITC','Comic Sans MS','Marker Felt',cursive", officeFont: "Kristen ITC", category: "cursive" },
    "Stylus BT": { cssFallback: "'Stylus BT','Brush Script MT','Snell Roundhand',cursive", officeFont: "Stylus BT", category: "cursive" },
    "Caveat": { cssFallback: "'Caveat','Comic Sans MS','Marker Felt',cursive", officeFont: "Caveat", category: "cursive" },
    // ---- Japanese sans-serif fonts ----
    "MS Gothic": { cssFallback: "'MS Gothic','Noto Sans CJK JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", officeFont: "MS Gothic", category: "sans-serif" },
    "MS PGothic": { cssFallback: "'MS PGothic','Noto Sans CJK JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", officeFont: "MS PGothic", category: "sans-serif" },
    "\uFF2D\uFF33 \uFF30\u30B4\u30B7\u30C3\u30AF": { cssFallback: "'\uFF2D\uFF33 \uFF30\u30B4\u30B7\u30C3\u30AF','Noto Sans CJK JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", officeFont: "\uFF2D\uFF33 \uFF30\u30B4\u30B7\u30C3\u30AF", category: "sans-serif" },
    "\uFF2D\uFF33 \u30B4\u30B7\u30C3\u30AF": { cssFallback: "'\uFF2D\uFF33 \u30B4\u30B7\u30C3\u30AF','Noto Sans CJK JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", officeFont: "\uFF2D\uFF33 \u30B4\u30B7\u30C3\u30AF", category: "sans-serif" },
    "Kozuka Gothic Pro R": { cssFallback: "'Kozuka Gothic Pro R','Noto Sans CJK JP','Hiragino Kaku Gothic ProN',sans-serif", officeFont: "Kozuka Gothic Pro R", category: "sans-serif" },
    "Kozuka Gothic Pro B": { cssFallback: "'Kozuka Gothic Pro B','Noto Sans CJK JP Bold','Hiragino Kaku Gothic ProN',sans-serif", officeFont: "Kozuka Gothic Pro B", category: "sans-serif" },
    "Kozuka Gothic Pro M": { cssFallback: "'Kozuka Gothic Pro M','Noto Sans CJK JP Medium','Hiragino Kaku Gothic ProN',sans-serif", officeFont: "Kozuka Gothic Pro M", category: "sans-serif" },
    "Kozuka Gothic Pro EL": { cssFallback: "'Kozuka Gothic Pro EL','Noto Sans CJK JP Light','Hiragino Kaku Gothic ProN',sans-serif", officeFont: "Kozuka Gothic Pro EL", category: "sans-serif" },
    "HGSKyokashotai": { cssFallback: "'HGSKyokashotai','Noto Sans CJK JP','Hiragino Kaku Gothic ProN',sans-serif", officeFont: "HGSKyokashotai", category: "sans-serif" },
    // ---- Japanese serif fonts ----
    "MS Mincho": { cssFallback: "'MS Mincho','Noto Serif CJK JP','Hiragino Mincho ProN','Yu Mincho',serif", officeFont: "MS Mincho", category: "serif" },
    "MS PMincho": { cssFallback: "'MS PMincho','Noto Serif CJK JP','Hiragino Mincho ProN','Yu Mincho',serif", officeFont: "MS PMincho", category: "serif" },
    // ---- CJK fonts (Chinese, Korean) ----
    "\u5B8B\u4F53": { cssFallback: "'\u5B8B\u4F53','Noto Serif CJK SC','Songti SC','STSong',serif", officeFont: "\u5B8B\u4F53", category: "serif" },
    "\u65B0\u7D30\u660E\u9AD4": { cssFallback: "'\u65B0\u7D30\u660E\u9AD4','Noto Serif CJK TC','Songti TC',serif", officeFont: "\u65B0\u7D30\u660E\u9AD4", category: "serif" },
    "\u9ED1\u4F53": { cssFallback: "'\u9ED1\u4F53','Noto Sans CJK SC','Heiti SC','STHeiti',sans-serif", officeFont: "\u9ED1\u4F53", category: "sans-serif" },
    "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4": { cssFallback: "'\u5FAE\u8EDF\u6B63\u9ED1\u9AD4','Noto Sans CJK TC','Heiti TC',sans-serif", officeFont: "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4", category: "sans-serif" },
    "\uB9D1\uC740 \uACE0\uB515": { cssFallback: "'\uB9D1\uC740 \uACE0\uB515','Apple SD Gothic Neo',sans-serif", officeFont: "\uB9D1\uC740 \uACE0\uB515", category: "sans-serif" },
    // ---- UI / system fonts ----
    "Lucida Sans Unicode": { cssFallback: "'Lucida Sans Unicode','Lucida Grande','Lucida Sans',sans-serif", officeFont: "Lucida Sans Unicode", category: "sans-serif" },
    "Segoe UI": { cssFallback: "'Segoe UI','-apple-system','Helvetica Neue',sans-serif", officeFont: "Segoe UI", category: "sans-serif" },
    "Segoe Sans Display": { cssFallback: "'Segoe Sans Display','-apple-system','Helvetica Neue',Arial,sans-serif", officeFont: "Segoe Sans Display", category: "sans-serif" },
    "Segoe Sans Display Semibold": { cssFallback: "'Segoe Sans Display Semibold','-apple-system','Helvetica Neue',Arial,sans-serif", officeFont: "Segoe Sans Display Semibold", category: "sans-serif" },
    "Segoe Sans Small Regular": { cssFallback: "'Segoe Sans Small Regular','Segoe UI','-apple-system','Helvetica Neue',sans-serif", officeFont: "Segoe Sans Small Regular", category: "sans-serif" },
    "Segoe Sans Text Regular": { cssFallback: "'Segoe Sans Text Regular','Segoe UI','-apple-system','Helvetica Neue',sans-serif", officeFont: "Segoe Sans Text Regular", category: "sans-serif" },
    "Grandview": { cssFallback: "'Grandview','Helvetica Neue',Arial,sans-serif", officeFont: "Grandview", category: "sans-serif" },
    "Nirmala UI": { cssFallback: "'Nirmala UI','Helvetica Neue',Arial,sans-serif", officeFont: "Nirmala UI", category: "sans-serif" },
    "Ebrima": { cssFallback: "'Ebrima','Helvetica Neue',Arial,sans-serif", officeFont: "Ebrima", category: "sans-serif" },
    // ---- Google Fonts / web fonts (sans-serif) ----
    // Preserve original font names in Office export for maximum fidelity.
    // Office apps will render these correctly if the fonts are installed,
    // and fall back gracefully if not. The cssFallback stack provides
    // alternatives for HTML rendering (import side) only.
    "Inter": { cssFallback: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Inter", category: "sans-serif" },
    "Inter Light": { cssFallback: "'Inter Light','Inter','Helvetica Neue',Arial,sans-serif", officeFont: "Inter Light", category: "sans-serif" },
    "Inter ExtraBold": { cssFallback: "'Inter ExtraBold','Inter','Helvetica Neue',Arial,sans-serif", officeFont: "Inter ExtraBold", category: "sans-serif" },
    "Roboto": { cssFallback: "'Roboto','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Roboto", category: "sans-serif" },
    "Open Sans": { cssFallback: "'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Open Sans", category: "sans-serif" },
    "Lato": { cssFallback: "'Lato','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Lato", category: "sans-serif" },
    "Montserrat": { cssFallback: "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Montserrat", category: "sans-serif" },
    "Montserrat SemiBold": { cssFallback: "'Montserrat SemiBold','Montserrat','Helvetica Neue',Arial,sans-serif", officeFont: "Montserrat SemiBold", category: "sans-serif" },
    "Montserrat ExtraBold": { cssFallback: "'Montserrat ExtraBold','Montserrat','Helvetica Neue',Arial,sans-serif", officeFont: "Montserrat ExtraBold", category: "sans-serif" },
    "Poppins": { cssFallback: "'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Poppins", category: "sans-serif" },
    "Source Sans Pro": { cssFallback: "'Source Sans Pro','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Source Sans Pro", category: "sans-serif" },
    "Nunito": { cssFallback: "'Nunito','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Nunito", category: "sans-serif" },
    "Raleway": { cssFallback: "'Raleway','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Raleway", category: "sans-serif" },
    "Ubuntu": { cssFallback: "'Ubuntu','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Ubuntu", category: "sans-serif" },
    "PT Sans": { cssFallback: "'PT Sans','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "PT Sans", category: "sans-serif" },
    "Noto Sans": { cssFallback: "'Noto Sans','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Noto Sans", category: "sans-serif" },
    "Fira Sans": { cssFallback: "'Fira Sans','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Fira Sans", category: "sans-serif" },
    "Work Sans": { cssFallback: "'Work Sans','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Work Sans", category: "sans-serif" },
    "Space Grotesk": { cssFallback: "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Space Grotesk", category: "sans-serif" },
    "Oswald": { cssFallback: "'Oswald','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Oswald", category: "sans-serif" },
    "Archivo": { cssFallback: "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Archivo", category: "sans-serif" },
    "Economica": { cssFallback: "'Economica','Helvetica Neue',Arial,sans-serif", officeFont: "Economica", category: "sans-serif" },
    "Syncopate": { cssFallback: "'Syncopate','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Syncopate", category: "sans-serif" },
    // ---- Google Fonts / web fonts (serif) ----
    "Playfair Display": { cssFallback: "'Playfair Display','Georgia','Times New Roman',serif", officeFont: "Playfair Display", category: "serif" },
    "Playfair Display SemiBold": { cssFallback: "'Playfair Display SemiBold','Playfair Display','Georgia',serif", officeFont: "Playfair Display SemiBold", category: "serif" },
    "Libre Baskerville": { cssFallback: "'Libre Baskerville','Georgia','Times New Roman',serif", officeFont: "Libre Baskerville", category: "serif" },
    "Merriweather": { cssFallback: "'Merriweather','Georgia','Times New Roman',serif", officeFont: "Merriweather", category: "serif" },
    "PT Serif": { cssFallback: "'PT Serif','Georgia','Times New Roman',serif", officeFont: "PT Serif", category: "serif" },
    "Noto Serif": { cssFallback: "'Noto Serif','Georgia','Times New Roman',serif", officeFont: "Noto Serif", category: "serif" },
    "Lora": { cssFallback: "'Lora','Georgia','Times New Roman',serif", officeFont: "Lora", category: "serif" },
    // ---- Google Fonts / web fonts (monospace) ----
    "Fira Code": { cssFallback: "'Fira Code','Courier New',monospace", officeFont: "Fira Code", category: "monospace" },
    "Source Code Pro": { cssFallback: "'Source Code Pro','Courier New',monospace", officeFont: "Source Code Pro", category: "monospace" },
    "JetBrains Mono": { cssFallback: "'JetBrains Mono','Courier New',monospace", officeFont: "JetBrains Mono", category: "monospace" },
    // ---- GitHub Copilot fonts ----
    "Ginto Copilot": { cssFallback: "'Ginto Copilot','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Ginto Copilot", category: "sans-serif" },
    "Ginto Copilot Light": { cssFallback: "'Ginto Copilot Light','Helvetica Neue Light','Helvetica Neue',Arial,sans-serif", officeFont: "Ginto Copilot Light", category: "sans-serif" },
    "Ginto Copilot 400": { cssFallback: "'Ginto Copilot 400','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Ginto Copilot 400", category: "sans-serif" },
    "Ginto Copilot Medium": { cssFallback: "'Ginto Copilot Medium','Ginto Copilot','Helvetica Neue',Arial,sans-serif", officeFont: "Ginto Copilot Medium", category: "sans-serif" },
    "Ginto Copilot Black": { cssFallback: "'Ginto Copilot Black','Ginto Copilot','Helvetica Neue',Arial,sans-serif", officeFont: "Ginto Copilot Black", category: "sans-serif" },
    "Ginto Copilot Thin": { cssFallback: "'Ginto Copilot Thin','Ginto Copilot Light','Helvetica Neue',Arial,sans-serif", officeFont: "Ginto Copilot Thin", category: "sans-serif" },
    // ---- Common system fonts ----
    "Arial": { cssFallback: "Arial,'Helvetica Neue',Helvetica,sans-serif", officeFont: "Arial", category: "sans-serif" },
    "Arial Black": { cssFallback: "'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Arial Black", category: "sans-serif" },
    "Georgia": { cssFallback: "Georgia,'Times New Roman',serif", officeFont: "Georgia", category: "serif" },
    "Georgia Regular": { cssFallback: "'Georgia Regular',Georgia,'Times New Roman',serif", officeFont: "Georgia", category: "serif" },
    "Courier New": { cssFallback: "'Courier New',Courier,monospace", officeFont: "Courier New", category: "monospace" },
    "Times": { cssFallback: "Times,'Times New Roman',serif", officeFont: "Times", category: "serif" },
    "Tahoma": { cssFallback: "'Tahoma','Verdana','Geneva',sans-serif", officeFont: "Tahoma", category: "sans-serif" },
    "Verdana": { cssFallback: "'Verdana','Geneva',sans-serif", officeFont: "Verdana", category: "sans-serif" },
    "Helvetica Neue Light": { cssFallback: "'Helvetica Neue Light','Helvetica Neue',Helvetica,Arial,sans-serif", officeFont: "Helvetica Neue Light", category: "sans-serif" },
    // ---- Symbol fonts ----
    "Wingdings": { cssFallback: "'Wingdings','Zapf Dingbats',sans-serif", officeFont: "Wingdings", category: "sans-serif" },
    "Wingdings 2": { cssFallback: "'Wingdings 2','Zapf Dingbats',sans-serif", officeFont: "Wingdings 2", category: "sans-serif" },
    "Wingdings 3": { cssFallback: "'Wingdings 3','Zapf Dingbats',sans-serif", officeFont: "Wingdings 3", category: "sans-serif" },
};
// Build case-insensitive lookup index (lowercase key → FontEntry)
const FONT_MAP_LOWER = {};
for (const [key, entry] of Object.entries(FONT_MAP)) {
    FONT_MAP_LOWER[key.toLowerCase()] = entry;
}
// ============================================================================
// Exported helpers
// ============================================================================
/**
 * Returns a CSS font-family value for the given font name (used by Office import).
 *
 * Looks up the font in FONT_MAP and returns the full CSS fallback stack.
 * For unknown fonts, wraps the name in quotes and appends sans-serif.
 * Handles malformed typeface attributes that already contain commas.
 */
export function cssFontFamily(fontName) {
    const entry = FONT_MAP[fontName];
    if (entry)
        return entry.cssFallback;
    // Try case-insensitive lookup
    const entryLower = FONT_MAP_LOWER[fontName.toLowerCase()];
    if (entryLower)
        return entryLower.cssFallback;
    // Handle malformed typeface attributes that already contain commas (e.g. "Arial,Sans-Serif")
    if (fontName.includes(',')) {
        return fontName.split(',').map(f => {
            const trimmed = f.trim();
            const lower = trimmed.toLowerCase();
            if (lower === 'sans-serif' || lower === 'serif' || lower === 'monospace' || lower === 'cursive' || lower === 'fantasy') {
                return lower;
            }
            return `'${trimmed}'`;
        }).join(',');
    }
    return `'${fontName}',sans-serif`;
}
/**
 * Maps a font family name to its Office-compatible equivalent (used by Office export).
 *
 * Returns the mapped Office font if found, or the original font if no mapping exists.
 * Lookup is case-insensitive.
 */
export function mapToOfficeFont(fontFamily) {
    const normalized = fontFamily.toLowerCase().trim();
    const entry = FONT_MAP_LOWER[normalized];
    return entry ? entry.officeFont : fontFamily;
}
/**
 * Extract and map fontFace from a CSS font-family string (used by Office export).
 *
 * Takes the first font in a comma-separated CSS font stack, strips quotes,
 * and maps it to an Office-compatible equivalent.
 */
export function extractFontFace(fontFamily) {
    if (!fontFamily)
        return undefined;
    const firstFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    return mapToOfficeFont(firstFont);
}
// ---- Category-based fallback fonts ----
// These are universally available system fonts used as OOXML `altFont` values.
// When the primary font (e.g. a Google Font) is missing, PowerPoint and
// LibreOffice will render using the altFont instead of an arbitrary substitute.
const CATEGORY_ALT_FONT = {
    'sans-serif': 'Arial',
    'serif': 'Georgia',
    'monospace': 'Courier New',
    'cursive': 'Comic Sans MS',
};
// Fonts that are universally pre-installed — no altFont needed.
const SYSTEM_FONTS = new Set([
    'arial', 'arial black', 'calibri', 'calibri light', 'cambria', 'cambria math',
    'consolas', 'courier new', 'georgia', 'georgia regular', 'times', 'times new roman',
    'tahoma', 'verdana', 'comic sans ms', 'impact', 'wingdings', 'wingdings 2',
    'wingdings 3', 'segoe ui', 'aptos',
]);
/**
 * Returns a system-safe alternate font for the given font face (used by Office export).
 *
 * This provides the OOXML `altFont` attribute value, which PowerPoint and
 * Word use when the primary font is not installed. Returns `undefined`
 * for fonts that are universally pre-installed (Arial, Georgia, etc.) since
 * they don't need a fallback.
 */
export function getAltFont(fontFace) {
    if (!fontFace)
        return undefined;
    const normalized = fontFace.toLowerCase().trim();
    // System fonts don't need a fallback
    if (SYSTEM_FONTS.has(normalized))
        return undefined;
    // Look up category from FONT_MAP to determine the right fallback
    const entry = FONT_MAP_LOWER[normalized];
    if (entry) {
        // Don't return an altFont that's the same as the primary font
        const alt = CATEGORY_ALT_FONT[entry.category];
        return alt.toLowerCase() === normalized ? undefined : alt;
    }
    // Unknown font — default to Arial as a safe sans-serif fallback
    return 'Arial';
}
/**
 * Returns the font-to-CSS-replacement mapping for HTML regex-based font
 * substitution (used by transform.ts).
 *
 * Returns entries as [fontName, cssReplacement] pairs where cssReplacement
 * is in the format "Georgia, serif" (Office font + category).
 * Only includes fonts that map to a different Office font (web fonts → Office equivalents).
 */
export function getFontReplacementEntries() {
    const entries = [];
    for (const [fontName, entry] of Object.entries(FONT_MAP)) {
        // Only include fonts where the Office font differs from the original
        // (e.g. "Inter" → "Calibri", but not "Calibri" → "Calibri")
        if (entry.officeFont.toLowerCase() !== fontName.toLowerCase()) {
            entries.push([fontName, `${entry.officeFont}, ${entry.category}`]);
        }
    }
    return entries;
}
//# sourceMappingURL=fonts.js.map