//const API = "http://localhost:3000"; // later const API = "https://youtube-api-s1v2.onrender.com";
export const API = location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://youtube-api-s1v2.onrender.com";
export async function api(endpoint, body) {
    const response = await fetch(API + endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok)
        throw new Error(json.error || "Unknown server error.");
    return json;
}
export async function loadJSON(JSONData/*, json = "json"*/) {
    const response = await fetch(JSONData/* + "." + json*/);
    const result = await response.json();
    return result;
}
export function loadURLQuery(querySearch) {
    const params = new URLSearchParams(window.location.search);
    return params.get(querySearch) ?? null;
}
export function incodeURLQuery(params) {
    let URL = window.location.href;
}
export function namePage(name, add = true) {
    document.querySelector("html > head > title").textContent = add ? name + " - Learn" : name;
}


export function isValidColorFormat(col) {
    if (typeof col !== "string") return false;
    return CSS.supports("color", col.trim());
}
export function cssToRgba(col) {
    const context = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
    context.fillStyle = col;
    context.fillRect(0, 0, 1, 1);
    //console.log(context.getImageData(0, 0, 1, 1).data);
    return context.getImageData(0, 0, 1, 1).data;
}
export function pixelToHex(pixel, alpha = false) {
    const r = (pixel & 255).toString(16).padStart(2, "0");
    const g = ((pixel >>> 8) & 255).toString(16).padStart(2, "0");
    const b = ((pixel >>> 16) & 255).toString(16).padStart(2, "0");
    if (!alpha) return `#${r}${g}${b}`;
    const a = ((pixel >>> 24) & 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`;
}
export function materialIcon(iconId, filled = false) {
    const res = document.createElement("span");
    res.classList.add("material-symbols-rounded");
    if (filled) res.classList.add("material-symbols-filled");
    res.textContent = iconId;
    return res;
}
export function imageToCanvas(img) {
    const canvas = document.createElement("canvas");
    canvas.height = img.height;
    canvas.width = img.width;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.mozImageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.drawImage(img, 0, 0);
    return canvas;
}
const canvasMimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp"
};

export function canvasToBlob(canvas, mimeType) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode this image.")), mimeType);
    });
}

export function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function joinBytes(parts) {
    const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

export function pngTextChunk(keyword, value) {
    const encoder = new TextEncoder();
    const type = encoder.encode("tEXt");
    const data = encoder.encode(`${keyword}\0${value}`);
    const chunk = new Uint8Array(12 + data.length);
    new DataView(chunk.buffer).setUint32(0, data.length);
    chunk.set(type, 4);
    chunk.set(data, 8);
    new DataView(chunk.buffer).setUint32(8 + data.length, crc32(joinBytes([type, data])));
    return chunk;
}

export async function addPngMetadata(blob, metadata = {}) {
    const source = new Uint8Array(await blob.arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((byte, index) => source[index] === byte)) return blob;
    const fields = Object.entries(metadata)
        .filter(([key, value]) => key && value !== undefined && value !== null && String(value).trim())
        .map(([key, value]) => pngTextChunk(key.slice(0, 79), String(value)));
    if (!fields.length) return blob;

    let offset = 8;
    while (offset + 12 <= source.length) {
        const length = new DataView(source.buffer, source.byteOffset + offset).getUint32(0);
        const type = String.fromCharCode(...source.slice(offset + 4, offset + 8));
        if (type === "IEND") break;
        offset += 12 + length;
    }
    if (offset + 12 > source.length) return blob;
    return new Blob([source.slice(0, offset), ...fields, source.slice(offset)], { type: "image/png" });
}

export async function addJpegMetadata(blob, metadata = {}) {
    const source = new Uint8Array(await blob.arrayBuffer());
    if (source[0] !== 0xFF || source[1] !== 0xD8) return blob;
    const entries = [
        [0x010E, metadata.Description || metadata.Title],
        [0x013B, metadata.Author],
        [0x8298, metadata.Copyright]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
    if (!entries.length) return blob;

    const encoder = new TextEncoder();
    const values = entries.map(([, value]) => joinBytes([encoder.encode(String(value)), new Uint8Array([0])]));
    const ifdLength = 2 + entries.length * 12 + 4;
    const tiff = new Uint8Array(8 + ifdLength + values.reduce((length, value) => length + value.length, 0));
    const view = new DataView(tiff.buffer);
    tiff.set([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]); // Little-endian TIFF header
    view.setUint16(8, entries.length, true);
    let dataOffset = 8 + ifdLength;
    entries.forEach(([tag], index) => {
        const entryOffset = 10 + index * 12;
        view.setUint16(entryOffset, tag, true);
        view.setUint16(entryOffset + 2, 2, true); // ASCII
        view.setUint32(entryOffset + 4, values[index].length, true);
        view.setUint32(entryOffset + 8, dataOffset, true);
        tiff.set(values[index], dataOffset);
        dataOffset += values[index].length;
    });
    const payload = joinBytes([encoder.encode("Exif\0\0"), tiff]);
    if (payload.length + 2 > 0xFFFF) return blob;
    const app1 = new Uint8Array(payload.length + 4);
    app1.set([0xFF, 0xE1]);
    new DataView(app1.buffer).setUint16(2, payload.length + 2);
    app1.set(payload, 4);
    return new Blob([source.slice(0, 2), app1, source.slice(2)], { type: "image/jpeg" });
}

export async function canvasToExportBlob(canvas, format = "png", metadata = {}) {
    const normalizedFormat = format.toLowerCase();
    const mimeType = canvasMimeTypes[normalizedFormat];
    if (!mimeType) throw new Error(`Unsupported export format: ${format}`);
    const blob = await canvasToBlob(canvas, mimeType);
    // Canvas encoding strips metadata. PNG tEXt and a minimal JPEG EXIF block are browser-safe to add.
    if (normalizedFormat === "png") return addPngMetadata(blob, metadata);
    if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") return addJpegMetadata(blob, metadata);
    return blob;
}

export async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
// console.log("COLOR: " + cssToRgba("#FFFF"));
// console.log("COLOR: " + cssToRgba("#F5A9B87F"));
// console.log("COLOR: " + cssToRgba("rgb(10, 10, 10)"));
// console.log("COLOR: " + cssToRgba("blue"));

export async function getImageMetadata(file) {
    if (!(file instanceof Blob)) throw new TypeError("Expected an image file.");
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let result;

    if (isJPEG(bytes)) {
        result = parseJPEGMetadata(buffer);
    } else if (isPNG(bytes)) {
        result = parsePNGMetadata(buffer);
    } else if (isWebP(bytes)) {
        result = parseWebPMetadata(buffer);
    } else {
        result = { type: "unknown", metadata: {} };
    }
    result.metadata.fileName = file.name || "";
    result.metadata.mimeType = file.type || "";
    result.metadata.fileSize = file.size;
    if (globalThis.ExifReader) {
        try {
            result.metadata.tags = await globalThis.ExifReader.load(file, { expanded: true });
        } catch (error) {
            // Images without EXIF are valid; keep the lightweight parser result.
            console.debug("No readable EXIF metadata found.", error);
        }
    }
    return result;
}
export function isJPEG(bytes) {
    return bytes[0] === 0xFF &&
           bytes[1] === 0xD8;
}
export function isPNG(bytes) {
    return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4E &&
        bytes[3] === 0x47
    );
}
export function isWebP(bytes) {
    return (
        bytes[0] === 0x52 && // R
        bytes[1] === 0x49 && // I
        bytes[2] === 0x46 && // F
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 && // W
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    );
}
export function parseJPEGMetadata(buffer) {
    const view = new DataView(buffer);
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xFF) {
            offset++;
            continue;
        }
        const marker = view.getUint8(offset + 1);
        if (marker === 0xD8 || marker === 0xD9 || marker === 0xDA) break;
        if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            offset += 2;
            continue;
        }
        if (marker === 0xE1) { // APP1
            const size = view.getUint16(offset + 2);
            if (size < 8 || offset + 2 + size > view.byteLength) break;
            const exifStart = offset + 4;
            const header = new TextDecoder()
                .decode(buffer.slice(exifStart, exifStart + 6));
            if (header.startsWith("Exif")) {
                return {
                    type: "jpeg",
                    metadata: {
                        exifFound: true,
                        rawExif: buffer.slice(
                            exifStart + 6,
                            offset + 2 + size
                        )
                    }
                };
            }
        }
        const segmentSize = view.getUint16(offset + 2);
        if (segmentSize < 2 || offset + 2 + segmentSize > view.byteLength) break;
        offset += 2 + segmentSize;
    }
    return {
        type: "jpeg",
        metadata: {
            exifFound: false
        }
    };
}
export function parsePNGMetadata(buffer) {
    const view = new DataView(buffer);
    const decoder = new TextDecoder();
    let offset = 8;
    const metadata = {
        text: {},
        exifFound: false
    };
    while (offset + 12 <= view.byteLength) {
        const length = view.getUint32(offset);
        if (offset + 12 + length > view.byteLength) break;
        const type = decoder.decode(
            buffer.slice(offset + 4, offset + 8)
        );
        const dataStart = offset + 8;
        const data = buffer.slice(
            dataStart,
            dataStart + length
        );
        if (type === "eXIf") {
            metadata.exifFound = true;
            metadata.rawExif = data;
        }
        if (type === "tEXt") {
            const text = decoder.decode(data);
            const split = text.indexOf("\0");
            if (split !== -1) {
                metadata.text[
                    text.slice(0, split)
                ] =
                    text.slice(split + 1);
            }
        }
        if (type === "iTXt") {
            metadata.iTXt =
                decoder.decode(data);
        }
        offset =
            dataStart +
            length +
            4;
    }
    return {
        type: "png",
        metadata
    };
}
export function parseWebPMetadata(buffer) {
    const decoder = new TextDecoder();
    let offset = 12;
    while (offset + 8 <= buffer.byteLength) {
        const type = decoder.decode(
            buffer.slice(offset, offset + 4)
        );
        const size =
            new DataView(buffer)
                .getUint32(offset + 4, true);

        if (type === "EXIF") {
            return {
                type: "webp",
                metadata: {
                    exifFound: true,
                    rawExif: buffer.slice(
                        offset + 8,
                        offset + 8 + size
                    )
                }
            };
        }
        offset += 8 + size + (size % 2);
    }
    return {
        type: "webp",
        metadata: {
            exifFound:false
        }
    };
}
export function getChildIndex(elem) {
    return [...elem.parentElement.children].indexOf(elem);
}
export function parseHtmlFromString(string) {
    return new DOMParser().parseFromString(string, "text/xml");
}
// Taken from https://developer.mozilla.org/en-US/play?uuid=ae2a5bee430be20af4b7053a928ea5f31c91d304&state=1VsPc5vIkv8qfYq3DtkSDEigP5Gcip3sJlXOy6s4d0nWciUDjIAYgRZGtmSXv9N9hvtkVz0DCCSUxH7avFyStaGnu6fn1z3NTM%2FsXcPns7AxbIzc4BqckKbpeNJw4ojTIGLJpHE8iQBGbkDD2IN4ziJBABjNsweAUUhtFsI0ToRoGCdtzpY8k5V%2FXkacJUBBNMM1DRcMgghotEK5GeUQJzAPnKucZ1ho14T6dW%2FpnEYlS7G7IJoveFrpcCRowFdzNp40pD0QuBsWgrZTRLBVZUR7RWikoTU5JNr8O%2BDEc%2BoEfJUrOn7ufl2kHLjPIGsabo9XMhdWZuYlNPLYpLGmCzs3Oli3CsTHk4ZeJs6CaDxpkAqJLje5Us7myKYSvTT20mD9ZE3l1A5ZZsuCzxe8LaAr%2B2bk0DkP4qiE%2FKd4kWShEUTgBtMpS1jEs9BIS7GwKTviduyuyk7kiew%2B8ez2dBE5yF6JDOTxK%2B8AI1p9B%2FATNh1PGj7n83SoaS67ZmE8Z4k6i2%2BDMKRqnHgai9r%2Fda65sZNqH5itnZ6fa%2B%2BYsN1h2n8j5KkmhvVZ4K8lnl1GNnMoTTzGx5PGZzuk0dWGrfjn3R8nG%2BZqtDogbWNEI%2B4ej%2BwF53GUB%2FB81UZIJHHSOD6N56uRJl%2BPxaQ6zqJ5pHG3jKjGkzqAfbb8d%2BLqs2U7m6MPR%2FTVy497QRSN2COiafjLhayfho8C%2BPxsPwCn4T4Bvvn1coJ%2F86ic8OrDfnICQrI%2FgOV38leD%2BNFpQggqzb0ALaHZH9Qh%2FfViOaSPiuUzau8FYoRkjwA7%2Fq8HsOM%2FCuDTV%2FsB2PH3CHB89SvGsLDqMSC%2FFYL7gFkCs1egf8FYFlY9DuizU39fQO81oper27Zrkp8J9R9hnKY0WWmnAtp0Th32JLPjMeB%2B%2FPQnvDDJXuDN4dgzwJb5KwD8aHAtc3%2FgWua%2FCu5IK%2B%2BgR5rYwMuijyarPseTCB%2BvjydRo9Vw0rQxbGT1oDvks%2BPEZckQ9PkS0jgM3KdrajuhbrBIh2DOlxl52U596sY3Q%2BjMl%2BI%2FncyXkHi2QgD%2FakBUoym5qXPlJfEicuXyaQg3fsCZaJvGEW9P6SwIV0OYNM6Zt2CTRgsmjVcsvGY8cKh8fZ4ENMTHlEZpO2VJMBUKZjTxgqjN4%2FkQzGtf0G4Cl%2FtDME0i7L2fRJNIljTuSs06Ib8VrW5rEnFfts%2Bp6waRJ4dGCpasdXs0T5iLf9e6djIKvpqBz%2BIoFiGZ60BnbmrJ6idhEDGatD30CYu4kodAe0Bc5rXyV57QKJ1TUYAh0On%2FVrR0e%2Bvnqr96TTDJulF4CSkCKkltZq1OHAXOthF2SJ0rILDbFtECer%2FCIMUkEYzeTmHZBB0Lf2UGbYZYGtyyDCo0W%2FzIlBkYogbJgrhwMykF0nDtcLWon26GzfWNkPBZ4PlcUvyS1LqWKQXdIJ2HdDWEIELntachW27FLlGthM3KZDvmPJ4NQVdN2SIjQ2aQuxJjIs0gFT5hwEWlcHpZGUeH5ED8sJqsWrmhpzzLZJlUNC9SlrRTFjKHDyGKoyK25xuoFHDgQ3saYlJx4nAxiwSVhoEXtQPOZukQHIYV6Dp%2FNVqNr5jTnDhKeSkeYAxu7CxmLOLqXwuWrM6FSXGiTBpilrnB9aSBUSQlhfvesyUvC3qMvwwZPp6sXrtKtfq8IfvPwLliyQ9IZ9XdtXhW9v0BBRsF4rUKny3fioLtt4b9xGdL4C4cA35XyuKJZ%2F%2BefZN%2FQE25NluvTwz0ARqrhYd6nX4aPkBjuRi3Q9%2FNQ8Zcrj3V6wvpQ%2FSV9071%2BuKrswdprO7Hdtjo%2BA%2BxsbTt2GnjgzRWtzL1Oper2xcm%2BWGlEcCk8WRz6V5W3ZpEVe2W%2BRjtpXVrjfZc%2F9m7P04%2Bn705%2F%2Fzm%2Bft3rz%2FCGC5QyQVRu7phGHq3R%2FotzLUdq9Mx8Ce%2BEVPvds3BwBhctjJ2Q9cHpNMd9A1ksPrEGgzMrqnjm056nYE1MC2rYCf9focYXUsfIIPR13t6v9%2FpWULYGAx6%2FR4hJrJflq19c%2F757PnJprFH2D3pml3DNDstOCJqb9Cx9F6vb7agTVRCuqRnkK7Vz%2Fo%2F0tVBrzcY9LsDtLBtqF2jbw4Mg5hCvGsSc9DpkUE%2BviOiEsMckC7p9HTZQ9%2Fo9fSeZRmiiz7pWz2zJ0coTdY0SDH1yIUQ8BjyjRI2zShPgiVwesUimCbxDHCPMNS0m5sb1U4WDguDyLXDOJ6pTjzTgshlSxWPT5%2B9%2FCv6jG7j8eePn%2F4UtIo7P3768%2FMLk9S4tGORXreHGHf6JrG6Any92yF90l170jBM0jWxqadb%2FV5fOIVYxNKttb%2BJ3hl0DOFsMujphUBX73U63wUBdyU%2FAQTLrI3rrml1BQgmukyGaJ90Oz2zFM6G1TMGckymbmYj7Rl6iYnog06nI0HUB%2FpA8AxM0iFdfTN0nUWCS0OxrYMx3AHuYRBabwiG3m%2BBPQQMVxrOfYqLKQL3T0HT4IlNXWqaqKmYz7NFyIN5uDpZvREIKhLIFvDFPGRNuXAJGYcAB05agP8un%2BbUrzDOoFdDFnncL1quipYLcllunMYJKMgRwhjIUwhhBF%2BfQnh0lNWrC4aZZJjBCK6ewuzoqAnBRXgJR4Xm8PJidgmH0tiLmbQrYXyRRBDkq69irIlnv4%2FPRPgoTja0jNmB0Ri90iVdE56BAxrohjowYAiK4sCRyFRmE8ny4fAQDLW71UUQ8ffxK7ZUgqr%2BN5T76jSM40QJmiqPz3kSRJ6iW011Tt1zThOuGLjpI5MGtp%2FFNyw5pSlTmvXDePXyIy7ZNsfx5cnBXWGDoybN%2B8q7t%2FFuN%2B%2B%2F1OmnooPnsgeMs6yXYsmVLRerpghG4YJgCvJVFUEI4%2FEYgcu0FNZmioTI%2FVp%2FJrMGs6zqEAzTbJYd%2FeXgLlN0f3AnmHYP6vzseWVAGGZ3kLTAa4GdTRm4h7Fcx4leNA3OGP%2FPFHx6zXJWPO7H2w9ifyDmhX4pTAJtjAYKSa%2F8Ypdf5DhnQQRjGRqzIFIy1c0yB10WHHRZx%2BGykFMx1ZbQRo3FBPRbkLYgFIlDeiTjHY9h7QlfzDHhAGBhygSj6HY8hqTCpigetMHGSSA0NeE3sHaJelVRG9qoLZOEIzDKgoIlgTZKrVm6csuZAyD2NooPh2CRZjYqTYMPDG5oxIHipRwvZGAzfsNYBARo5OLG%2BX%2F%2FJwfAh1Fl6EdjbM%2FDTwCHluAYjhBLtEYamuJKaQ0fPAMCw4yigaJDWxpJ7VQx4BBCaIPebBay%2F1jMbJYoSgqHuHnGKf57sGSukjOFJaawnqkU8ne5d4uQ3Qp4LoJ9xwzelpeTuTpFKpPMT0Pl4M4vbCLNezi4S8vvv8HBXVghHGRQy05G4lv0DL6ABtlMLbg7zfsvgPUwWZ68b%2B6cwh9Otkclp%2FEPjyn7jvpJPMO5g06pujAEDUxS8iF28AFjAx2bCWpgNEujLfhOkE8nKP4d7gLbGxuxRUA%2FCBRPELoHgbYbsI%2Bf%2FnxhkodmvSTP7tn3MsEBiA9fKb1VWbxtFnuDxd5kWXtjubrFNLa5HKlZhrbgIjP9sgLjHSyHqOaCXMpuWrCSBL0g3EqCURB2TZ8ydjvCrQ628lhq4K94XR7SZyt5OLhbrm7VZeFbU8wvpK1qaLcFTU4wUywkm%2Fd7jRrL%2FP8fNcW6%2FSdHjWX%2By1FTwL8raizz3x410vIXlil2B2qna%2FZEXb1j4g5E7IeMgdkvaLhCL9Barm7fx2fUrkFp2YJVC27ro%2Bwia73ETvNndUbninLdgqAJ4%2BP8G3%2BNq64XlnkRyL1BgeM1HOOanvT7ptU1dQueyezv2AlXrpswhGs4hAHpqMbAKv514Ah0C3cBerby2YilcIhNcAgr%2FHhYLaBDMAnBDwyuz1ZNsTszJAV5bpvfi6Yzau85ARVVOxivfbBc3VYDLaT4UQqprYblIABJozU0u0zb96f%2FfSzuKewrI30zF30zC5UhnKU7s8%2B6ElbOPFmUYohKeMpBJ2djJb%2BJ0mZtH5X6VQtN2Q5FIX1BLkUYyhf9UkSgfDEuv7V%2BfHv1mNDLLd5yWSW4BJdycCd%2BlwJM5ipJpbVU%2B%2B%2F78oUUvX36qnbBjMvKnVGWLSjzrUr6V8IV3KriNsaGw3zLJrZlORPlNDIUVNgU688%2BnkiKln%2B%2BXu%2Biv71lKbu7BU4Ll8C7HXp2%2BuqnZpKi8g7jNbYhtTfyjONjnnH87Tzj%2BKpTQ%2FP%2FzjxDMWrPTv2aIPhWYBfB%2F%2B3R5tMSR9sCJ39Gz%2BXPflG5K5c9dkzQU%2F8xE1TYuD3WzRkqHJMZuz0XK84pU%2F2%2Fb4bKo8r43R8nz4vKVzb3OFZKInYDb6fT1EkYi05pdE1TRW%2BB3sQDxdM4wuNLZdIwXHnsAiimToMwPOerkCFYFeo75nBF1jyFlnLdhYqyC3J6jL%2BeUY%2B9oJyWuVXkqTg%2FW4EMhTTmZUnwMoKeE%2ByMYOSELCAEsZOvQkUQb0G0mLuUM3m8U2C0PhxWUxypuibkZeTNql8zO%2FDPTlfVIIpYsi771fBuHaVWZL7gxYuDO0dNMFIc1ZO%2F7Hv8WQRGERYZbXdgQN1Ra7VHuVTGQwM4uMNqaPYF30gpWBfd2WLXtDza4q2D3Iq95YpNhv7mQW2dF4p6SPaN2Tw6rZEpvutSpO7csUaqvBleC24eKe4QzPdDmZGbZ6cbQBRfKslecyC8IVBaqxQi3%2BmjlD23a%2BxBFHClSDDZ%2FQiVuu7LaxbxsyDlLGJ4sJvdR2iBwsr7jtJlgDwFZ2mLqfK6nSoukzazXclb%2BytzuErTNPAipXzC04JScobyhQupYasKX5LNhSrXLAqxMqeM3Yy9mkK29N2vl6hrWx4KDZduqKKRj7FsGOI3p0nKXkdcQSk1DQOHYVrvNFugW806KW%2BHVKcF5m4pe4eU2YJeVaoIiZIPKinx53mhqvahfsjNEMP%2BPYwp3xGh23bCGCpeewwmPzJI2HFH4XkYipsV5f9dE%2FJbpU11GicvqeMriiSVhy4pdVg5YeBcbWO1K2ojtszvKZ0HdhhE3jrJPM1FI3odeJTHieqEwdyOaeKqN0nAmUAFVTYL3kJzOVdNGqfxPGDuf0waBWPK%2BPtgxuIFV5Sqpd9SsippuG%2FhIQPJ%2B76vm9wPc%2BcjctOD5sQ3gyW7u4dp%2B6m4G8d9NmN45ZcmV437%2FwM%3D&srcPrefix=%2Fen-US%2Fdocs%2FWeb%2FCSS%2FGuides%2FColors%2FColor_format_converter%2F
const LRGB_LMS_MATRIX = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_LAB_MATRIX = [
  [+0.2104542553, +0.793617785, -0.0040720468],
  [+1.9779984951, -2.428592205, +0.4505937099],
  [+0.0259040371, +0.7827717662, -0.808675766],
];
// srgb-linear to xyz-d50
// matrix taken from http://www.brucelindbloom.com/index.html?Eqn_RGB_to_XYZ.html
const LRGB_XYZ_D50_MATRIX = [
  [0.4360747, 0.3850649, 0.1430804],
  [0.2225045, 0.7168786, 0.0606169],
  [0.0139322, 0.0971045, 0.7141733],
];
// srgb-linear to xyz-d65
// matrix taken from http://www.brucelindbloom.com/index.html?Eqn_RGB_to_XYZ.html
const LRGB_XYZ_D65_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
export function multiplyByMatrix(matrix, tuple) {
  let i = [0, 0, 0];
  let j = matrix.length;
  let k = matrix[0].length;
  for (let l = 0; l < j; l++)
    for (let m = 0; m < k; m++) i[l] += matrix[l][m] * tuple[m];
  return i;
}
export function rgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function intToHex(i) {
  return Math.floor(i).toString(16).padStart(2, "0").toLowerCase();
}
export function rgbToHEXText(c) {
  return `#${intToHex(c.r)}${intToHex(c.g)}${intToHex(c.b)}`;
}
export function rgbaToHEXAText(color) {
  const hexText = rgbToHEXText(color);
  if (color.alpha === 1.0) {
    return hexText;
  }
  const alpha = intToHex(color.alpha * 255);
  return `${hexText}${alpha}`;
}
export function rgbaToHSLA(color) {
  let { r, g, b, alpha } = color;
  // Let's have r, g, b in the range [0, 1]
  r /= 255;
  g /= 255;
  b /= 255;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const delta = max - min;
  let h, s, l;

  if (delta === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else h = (r - g) / delta + 4;
  h = Math.round(h * 60);

  // We want an angle between 0 and 360°
  if (h < 0) {
    h += 360;
  }

  l = (max + min) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = Number((s * 100).toFixed(1));
  l = Number((l * 100).toFixed(1));

  return { h, s, l, alpha };
}
export function toHSLAText(color) {
  const { h, s, l, alpha } = rgbaToHSLA(color);
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%${
    alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""
  })`;
}
export function rgbaToHWBAText(color) {
  let { h, s, l, alpha } = rgbaToHSLA(color);
  const chroma = s * (1 - Math.abs(l / 50 - 1));
  let W = (l - chroma / 2).toFixed(0);
  let B = (100 - l - chroma / 2).toFixed(0);
  return `hwb(${h} ${W}% ${B}%${alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""})`;
}
export function rgbaToXYZD50(color) {
  let { r, g, b, alpha } = color;
  r = rgbToLinear(r / 255) * 255;
  g = rgbToLinear(g / 255) * 255;
  b = rgbToLinear(b / 255) * 255;

  const xyz = multiplyByMatrix(LRGB_XYZ_D50_MATRIX, [r, g, b]);
  return { x: xyz[0] / 255, y: xyz[1] / 255, z: xyz[2] / 255, alpha };
}
export function rgbaToXYZD50Text(color) {
  let { alpha } = color;
  const xyz = rgbaToXYZD50(color);
  return `color(xyz-d50 ${xyz.x.toFixed(5)} ${xyz.y.toFixed(5)} ${xyz.z.toFixed(
    5,
  )}${alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""})`;
}
export function rgbaToXYZD65(color) {
  let { r, g, b, alpha } = color;
  r = rgbToLinear(r / 255) * 255;
  g = rgbToLinear(g / 255) * 255;
  b = rgbToLinear(b / 255) * 255;

  const xyz = multiplyByMatrix(LRGB_XYZ_D65_MATRIX, [r, g, b]);
  return { x: xyz[0] / 255, y: xyz[1] / 255, z: xyz[2] / 255, alpha };
}
export function rgbaToXYZD65Text(color) {
  let { alpha } = color;
  const xyz = rgbaToXYZD65(color);
  return `color(xyz-d65 ${xyz.x.toFixed(5)} ${xyz.y.toFixed(5)} ${xyz.z.toFixed(
    5,
  )}${alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""})`;
}
const D65 = [0.3457 / 0.3585, 1, 0.2958 / 0.3585];
export function xyzToLab(color) {
  let { x, y, z, alpha } = color;
  [x, y, z] = [x, y, z].map((v, i) => {
    v /= D65[i];
    return v > 0.0088564516 ? Math.cbrt(v) : v * 903.2962962962963 + 16 / 116;
  });
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z), alpha };
}
export function rgbaToLabText(color) {
  let { alpha } = color;
  const xyz = rgbaToXYZD50(color);
  const lab = xyzToLab(xyz);
  return `lab(${lab.l.toFixed(3)} ${lab.a.toFixed(3)} ${lab.b.toFixed(3)}${
    alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""
  })`;
}
export function rgbToOklab(color) {
  let { r, g, b, alpha } = color;
  r = rgbToLinear(r / 255);
  g = rgbToLinear(g / 255);
  b = rgbToLinear(b / 255);
  const lms = multiplyByMatrix(LRGB_LMS_MATRIX, [r, g, b]).map((v) =>
    Math.cbrt(v),
  );

  const oklab = multiplyByMatrix(LMS_LAB_MATRIX, lms);
  return { l: oklab[0], a: oklab[1], b: oklab[2], alpha };
}
export function toOkLabText(color) {
  let { alpha } = color;
  const oklab = rgbToOklab(color);
  return `oklab(${oklab.l.toFixed(5)} ${oklab.a.toFixed(5)} ${oklab.b.toFixed(
    5,
  )}${alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""})`;
}
export function labToLCH(color) {
  const { l, a, b, alpha } = color;
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) {
    h += 360;
  }
  return { l, c, h, alpha };
}
export function toLCHText(color) {
  let { alpha } = color;
  const xyz = rgbaToXYZD50(color);
  const lab = xyzToLab(xyz);
  const lch = labToLCH(lab);
  return `lch(${lch.l.toFixed(3)} ${lch.c.toFixed(3)} ${lch.h.toFixed(3)}${
    alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""
  })`;
}
export function rgbaToOkLCh(color) {
  const lab = rgbToOklab(color);
  const oklch = labToLCH(lab);
  return { l: oklch.l, c: oklch.c, h: oklch.h, alpha: color.alpha };
}
export function toOkLChText(color) {
  let { alpha } = color;
  const oklch = rgbaToOkLCh(color);
  return `oklch(${oklch.l.toFixed(5)} ${oklch.c.toFixed(5)} ${oklch.h.toFixed(
    5,
  )}${alpha < 1.0 ? ` / ${alpha.toFixed(3)}` : ""})`;
}
export function colorToRGBA(c) {
  const ctx = new OffscreenCanvas(1, 1).getContext("2d");
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return {
    r: data[0],
    g: data[1],
    b: data[2],
    alpha: data[3] / 255,
  };
}
export function generateRandomHex() {
    return '#'+(Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
}
export async function svgToPath(file) {
    const text = await file.text();

    const parser = new DOMParser();
    const svg = parser.parseFromString(text, "image/svg+xml");

    const paths = svg.querySelectorAll("path");

    const result = new Path2D();

    paths.forEach(path => {
        result.addPath(
            new Path2D(path.getAttribute("d"))
        );
    });

    return result;
}
export async function loadSVG(file) {

    const url = URL.createObjectURL(file);

    const img = new Image();

    img.src = url;

    await img.decode();

    URL.revokeObjectURL(url);

    return img;
}
export function alertJson(json) {
    const keys = Object.keys(json);
    let res = "";
    keys.forEach(key => {
        res += `${key}:\u00A0\u00A0\u00A0\u00A0\t${JSON.stringify(json[key])}\n\n`;
    });
    alert(res);
}
export function addHoldEventListener(elem, listeners, holdTime) {
    let holdTimer;
    let isHold = false;
    let pointerDown = false;
    let pointerId = null;
    let pointerType = null;
    elem.addEventListener('pointerdown', e => { // Ignore non-primary mouse buttons
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        elem.setPointerCapture(e.pointerId);
        pointerType = e.pointerType;
        pointerId = e.pointerId;
        pointerDown = true;
        isHold = false;
        if (pointerType === 'touch' || pointerType === 'pen') { // Only start the hold timer for touch / pen
            holdTimer = setTimeout(() => {
                if (!pointerDown) return;
                isHold = true;
                listeners.onHold(e);
            }, holdTime);
        }
    });
    elem.addEventListener('pointerup', e => {
        //console.log(elem);
        if (!pointerDown || e.pointerId !== pointerId) return;
        pointerDown = false;
        clearTimeout(holdTimer);
        if (pointerType === 'mouse') { // Mouse always behaves like a normal click
            listeners.onClick(e);
            return;
        } // Touch / pen: click if the hold wasn't triggered
        if (elem.hasPointerCapture?.(e.pointerId))
                elem.releasePointerCapture(e.pointerId);
        if (!isHold) listeners.onClick(e);
    });
    elem.addEventListener('pointercancel', e => {
        if (e.pointerId !== pointerId) return;
        pointerDown = false;
        clearTimeout(holdTimer);
        isHold = true;
        if (elem.hasPointerCapture?.(e.pointerId))
                elem.releasePointerCapture(e.pointerId);
    });
    elem.addEventListener('pointerleave', () => {
        if (!pointerDown) return;
        pointerDown = false;
        clearTimeout(holdTimer);
    });
    // elem.addEventListener('pointermove', e => {
    //     alert("MOVE" + pointerDown);
    //     if (pointerDown && (pointerType === 'touch' || pointerType === 'pen')) {
    //         pointerDown = false;
    //         clearTimeout(holdTimer);
    //         isHold = true;
    //     }
    // });
}

export function measureText(string, font) {
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("2d");
    context.font = font;
    const size = context.measureText(string);
    const height = Math.ceil(size.actualBoundingBoxAscent + size.actualBoundingBoxDescent);
    const width  = Math.ceil(size.width);
    return { h: height, w: width };
}
export function css( element, property ) {
    return window.getComputedStyle( element, null ).getPropertyValue( property );
}

/*
export function addHoldEventListener(elem, listeners, holdTime) {
    let holdTimer;
    let isHold = false;
    let pointerDown = false;
    let pointerId = null;
    let pointerType = null;
    let suppressClick = false;

    const preventClickThrough = e => {
        if (!suppressClick) return;

        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();

        document.removeEventListener(
            'click',
            preventClickThrough,
            true
        );
    };

    elem.addEventListener('pointerdown', e => {
        // Ignore non-primary mouse buttons
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        elem.setPointerCapture(e.pointerId);

        pointerType = e.pointerType;
        pointerId = e.pointerId;
        pointerDown = true;
        isHold = false;

        if (pointerType === 'touch' || pointerType === 'pen') {
            holdTimer = setTimeout(() => {
                if (!pointerDown) return;

                isHold = true;
                listeners.onHold(e);
            }, holdTime);
        }
    });

    elem.addEventListener('pointerup', e => {
        if (!pointerDown || e.pointerId !== pointerId) return;

        pointerDown = false;
        clearTimeout(holdTimer);

        if (elem.hasPointerCapture?.(e.pointerId)) {
            elem.releasePointerCapture(e.pointerId);
        }

        if (!isHold) {
            // Suppress the native click generated by this pointer interaction.
            suppressClick = true;

            document.addEventListener(
                'click',
                preventClickThrough,
                true
            );

            listeners.onClick(e);
        }
    });

    elem.addEventListener('pointercancel', e => {
        if (e.pointerId !== pointerId) return;

        pointerDown = false;
        clearTimeout(holdTimer);
        isHold = true;

        if (elem.hasPointerCapture?.(e.pointerId)) {
            elem.releasePointerCapture(e.pointerId);
        }
    });

    elem.addEventListener('pointerleave', () => {
        if (!pointerDown) return;

        pointerDown = false;
        clearTimeout(holdTimer);
    });
}
*/
/*function addHoldEventListener(elem, onClick, onHold, holdTime) {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let holdTimer;
    let isHold = false;
    if (isTouchDevice) {
        elem.addEventListener('touchstart', e => {
            isHold = false;
            holdTimer = setTimeout(() => {
                isHold = true
                onHold(e);
            }, holdTime);
        });
        elem.addEventListener('touchend', e => {
            clearTimeout(holdTimer);
            if (!isHold) onClick(e);
        });
        elem.addEventListener('touchmove', () => {
            clearTimeout(holdTimer);
            isHold = true;
        });
    } else {
        elem.addEventListener('click', e => {
            console.log("ABCD");
            onClick(e);
        });
        console.log("EFGH");
    }
    console.log(isTouchDevice);
}*/
