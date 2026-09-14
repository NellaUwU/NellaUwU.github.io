const VOID_TAGS = new Set(["lb", "ln", "ll", "lg", "ld", "img", "link", "align", "table"]);

export function parseMarkup(source = "") {
    return source.replace(/\r\n?/g, "\n").split("\n").map(parseMarkupLine);
}

export function parseMarkupLine(source) {
    const tokens = [], styles = [];
    const pattern = /<(\/)?([a-z][\w-]*)(?:\s+([^>]*?))?\s*(\/?)>/gi;
    let cursor = 0, match;
    while ((match = pattern.exec(source))) {
        if (match.index > cursor) tokens.push({ type: "text", text: source.slice(cursor, match.index), styles: [...styles] });
        const tag = match[2].toLowerCase(), attributes = parseAttributes(match[3] || "");
        if (match[1]) { const index = styles.map(style => style.tag).lastIndexOf(tag); if (index >= 0) styles.splice(index, 1); }
        else if (match[4] || VOID_TAGS.has(tag)) tokens.push({ type: "element", tag, attributes, styles: [...styles] });
        else styles.push({ tag, attributes });
        cursor = pattern.lastIndex;
    }
    if (cursor < source.length) tokens.push({ type: "text", text: source.slice(cursor), styles: [...styles] });
    return tokens;
}

export function parseAttributes(source) {
    const attributes = {}, pattern = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
    let match; while ((match = pattern.exec(source))) attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
    return attributes;
}

function roman(number) { const values = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]; return values.reduce((result, [value, glyph]) => { while (number >= value) { result += glyph; number -= value; } return result; }, ""); }
function listPrefix(tag, number) { return tag === "lb" ? "* " : tag === "ln" ? `${number}. ` : tag === "ll" ? `${String.fromCharCode(97 + (number - 1) % 26)}. ` : tag === "lg" ? `${roman(number)}. ` : "- "; }
function words(text) { return text.split(/(\s+)/).filter(Boolean); }

export function textStyle(styles, settings, scale) {
    let size = settings.body.fontSize, weight = "", italic = "", family = "sans-serif", offset = 0;
    for (const style of styles) {
        if (style.tag === "b") weight = "bold "; if (style.tag === "i") italic = "italic ";
        if (/^h[0-9]$/.test(style.tag)) size = settings.body.fontSize * (settings.body[style.tag] ?? 1);
        if (style.tag === "sp" || style.tag === "sb") { size *= .7; offset = (style.tag === "sp" ? -.35 : .35) * size; }
        if (style.tag === "font" && /^[\w ,'-]+$/.test(style.attributes.src || "")) family = style.attributes.src;
    }
    return { font: `${italic}${weight}${size * scale}px ${family}`, offset: offset * scale, size: size * scale };
}

export function measureMarkup(lines, ctx, width, settings, scale = 1) {
    const lineHeight = settings.body.fontSize * 1.35 * scale; let rows = 0, largestText = lineHeight;
    for (const tokens of lines) {
        let x = 0; rows++;
        for (const token of tokens) {
            if (token.type === "element") { if (["lb","ln","ll","lg","ld"].includes(token.tag)) { ctx.font = textStyle(token.styles, settings, scale).font; x += ctx.measureText("VIII. ").width; } if (token.tag === "img") { x += 96 * scale; rows += 3; } if (token.tag === "table") rows += Math.max(1, Number(token.attributes.rows) || 1); continue; }
            const style = textStyle(token.styles, settings, scale); largestText = Math.max(largestText, style.size * 1.2); ctx.font = style.font;
            for (const word of words(token.text)) { const wordWidth = ctx.measureText(word).width; if (x && !/^\s+$/.test(word) && x + wordWidth > width) { rows++; x = 0; } x += wordWidth; }
        }
    }
    return Math.max(lineHeight, rows * largestText);
}

const images = new Map();
function getImage(src, redraw) { if (!src) return null; if (!images.has(src)) { const image = new Image(); image.onload = redraw; image.src = src; images.set(src, image); } return images.get(src); }

export function drawMarkup(lines, ctx, box, settings, scale, redraw) {
    const lineHeight = settings.body.fontSize * 1.35 * scale; let y = box.y + lineHeight, list = 0;
    for (const original of lines) {
        const tokens = [...original]; let align = "left";
        if (tokens[0]?.type === "element" && tokens[0].tag === "align") align = tokens.shift().attributes.align || "left";
        const fragments = tokens.flatMap(token => token.type === "text" ? words(token.text).map(text => ({ ...token, text })) : [token]);
        let total = 0; for (const token of fragments) { if (token.type === "text") { ctx.font = textStyle(token.styles, settings, scale).font; total += ctx.measureText(token.text).width; } }
        let x = box.x + (total <= box.width && align === "middle" ? (box.width - total) / 2 : total <= box.width && align === "right" ? box.width - total : 0);
        for (const token of fragments) {
            if (token.type === "text") { const style = textStyle(token.styles, settings, scale); ctx.font = style.font; const width = ctx.measureText(token.text).width; if (x > box.x && !/^\s+$/.test(token.text) && x + width > box.x + box.width) { x = box.x; y += lineHeight; } ctx.fillStyle = "#111"; ctx.fillText(token.text, x, y + style.offset); x += width; continue; }
            const style = textStyle(token.styles, settings, scale); ctx.font = style.font;
            if (["lb","ln","ll","lg","ld"].includes(token.tag)) { const prefix = listPrefix(token.tag, ++list); ctx.fillStyle = "#111"; ctx.fillText(prefix, x, y); x += ctx.measureText(prefix).width; }
            else if (token.tag === "link") { const label = token.attributes.url || "link"; ctx.fillStyle = "#0759a6"; ctx.fillText(label, x, y); const width = ctx.measureText(label).width; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + width, y + 2); ctx.strokeStyle = "#0759a6"; ctx.stroke(); x += width; }
            else if (token.tag === "img") { const image = getImage(token.attributes.src, redraw), width = Math.min(120 * scale, box.x + box.width - x), height = 72 * scale; if (image?.complete && image.naturalWidth) ctx.drawImage(image, x, y - lineHeight, width, height); else { ctx.strokeStyle = "#777"; ctx.strokeRect(x, y - lineHeight, width, height); } x += width; y += height - lineHeight; }
            else if (token.tag === "table") { const cols = Math.max(1, Number(token.attributes.cols) || 1), rows = Math.max(1, Number(token.attributes.rows) || 1), cellW = box.width / (cols + 1); ctx.strokeStyle = "#777"; for (let r = 0; r <= rows + 1; r++) { ctx.beginPath(); ctx.moveTo(box.x, y - lineHeight + r * lineHeight); ctx.lineTo(box.x + box.width, y - lineHeight + r * lineHeight); ctx.stroke(); } for (let c = 0; c <= cols + 1; c++) { ctx.beginPath(); ctx.moveTo(box.x + c * cellW, y - lineHeight); ctx.lineTo(box.x + c * cellW, y + rows * lineHeight); ctx.stroke(); } y += (rows + 1) * lineHeight; x = box.x; }
        }
        y += lineHeight;
    }
    return y - box.y;
}
