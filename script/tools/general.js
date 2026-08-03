const dropZone = document.querySelector("#dropZone");
const fileInput = document.querySelector("#input");
const imgsPreview = document.querySelector("ul.imgsPreview");
let usedFirstTime = false;
//TODO: add FileAccessDate, FileInodeChangeDate & FileModifyDate to metadata editor
const actionOptions = [
    { name: "Choose an action", id: "" },
    { name: "Change color", id: "changeCol" },
    { name: "Crop", id: "crop" },
    { name: "Change Quality", id: "quality" },
    { name: "Set size", id: "setSize" },
    { name: "Download", id: "download" },
    { name: "Other", id: "" },
    { name: "List image colors", id: "getColors" },
    { name: "Edit Metadata", id: "metadata" },
    { name: "Invert colors", id: "invert" }
];
const colorTypeOptions = [
    { name: "Detect", id: "det" },
    { name: "Hex", id: "hex" },
    { name: "RGBA", id: "rgba" }
];

class ActionClass {
    forEachPixel(imgData, callback) {
        const { width, height, data } = imgData;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                callback(x, y, data[i], data[i + 1], data[i + 2], data[i + 3], i, data);
            }
        }
    }
    isEqualPixel(a, b, percentage) {
        if (a.length !== b.length) return false;
        const maxDiff = 255 * Number(percentage) / 100;
        return a.every((value, index) => Math.abs(value - b[index]) <= maxDiff);
    }
    replaceColor(imgData, from, to, percentage) {
        const fromColor = cssToRgba(from);
        const toColor = cssToRgba(to);
        const result = new Uint8ClampedArray(imgData.data);
        this.forEachPixel({ width: imgData.width, height: imgData.height, data: result }, (x, y, r, g, b, a, index, data) => {
            if (this.isEqualPixel([r, g, b, a], fromColor, percentage)) {
                data[index] = toColor[0];
                data[index + 1] = toColor[1];
                data[index + 2] = toColor[2];
                data[index + 3] = toColor[3];
            }
        });
        return new ImageData(result, imgData.width, imgData.height);
    }
    scaleCanvas(source, percentage, smoothing) {
        if (isNaN(percentage) || percentage <= 0) {
            alert("Invalid percentage: " + percentage);
            return;
        }
        const canvas = source instanceof HTMLCanvasElement
            ? source
            : source.canvas;
        const scale = percentage / 100;
        const newCanvas = document.createElement("canvas");
        newCanvas.width = Math.round(canvas.width * scale);
        newCanvas.height = Math.round(canvas.height * scale);
        const ctx = newCanvas.getContext("2d");
        // Better quality scaling
        //console.log(smoothing);
        ctx.imageSmoothingEnabled = false;
        if (smoothing != "none") {
            //console.log("teste");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = smoothing;
        }
        //console.log(ctx.imageSmoothingEnabled, ctx.imageSmoothingQuality);
        ctx.drawImage(
            canvas, 0, 0,
            newCanvas.width,
            newCanvas.height
        );
        return newCanvas;
    }
}
const Action = new ActionClass();

function arrayToOptionList(options, element) {
    options.forEach(({ id, name }) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = name;
        option.disabled = id === "";
        element.appendChild(option);
    });
}

function copyCanvas(source, destination) {
    destination.width = source.width;
    destination.height = source.height;
    const context = destination.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, destination.width, destination.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);
}

function resizeCanvas(source, destination, width, height, smoothing = "high") {
    destination.width = width;
    destination.height = height;
    const context = destination.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = smoothing !== "none";
    if (context.imageSmoothingEnabled) context.imageSmoothingQuality = smoothing;
    context.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
}

function editableMetadata(metadata = {}) {
    const text = metadata.text || {};
    const exif = metadata.tags?.exif || {};
    const valueOf = (tag) => tag?.description ?? tag?.value?.join?.("") ?? tag?.value ?? "";
    return {
        Title: text.Title || text.title || valueOf(exif.ImageDescription),
        Author: text.Author || text.author || valueOf(exif.Artist),
        Description: text.Description || text.description || valueOf(exif.UserComment),
        Copyright: text.Copyright || text.copyright || valueOf(exif.Copyright)
    };
}

async function getItemMetadata(item) {
    await item._metadataReady;
    return item._metadata || {};
}

function renderImageIntoCanvas(image, canvas) {
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function getInputCanvas(item) {
    if (!item._isChained) return item._originalCanvas;
    const previous = item.previousElementSibling;
    return previous?.querySelector(".imgWrap > .previewWrap > canvas");
}

// async function readImageMetadata(img) {
//     const buffer = await img.arrayBuffer();
//     const bytes = new Uint8Array(buffer);
//     console.log("File:", img.name);
//     console.log("Size:", bytes.length);
//     console.log("First bytes:", [...bytes.slice(0, 20)]
//         .map(x => x.toString(16).padStart(2, "0"))
//         .join(" "));

//     const text = new TextDecoder().decode(bytes.slice(0, 2000));
//     console.log(text.includes("Exif") ? "Contains Exif" : "No Exif found");
//     return;
//     for (let i = 0; i < bytes.length - 4; i++) {
//         if (
//             bytes[i]     === 0x45 && // E
//             bytes[i + 1] === 0x78 && // x
//             bytes[i + 2] === 0x69 && // i
//             bytes[i + 3] === 0x66    // f
//         ) {
//             const exifStart = i + 6; // skip "Exif\0\0"
//             const exifBuffer = buffer.slice(exifStart);
//             return exifReader(exifBuffer);
//         }
//     }
//     throw new Error("No EXIF found");
// }

function addAction(afterItem, file) {
    const item = document.createElement("li");
    const preview = document.createElement("canvas");
    const previewWrap = document.createElement("div");
    const generalWrap = document.createElement("div");
    const actionWrap = document.createElement("div");
    const imageWrap = document.createElement("div");
    const actionSelect = document.createElement("select");
    const actions = document.createElement("div");
    const buttonWrap = document.createElement("div");
    const runButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const chainButton = document.createElement("button");
    let markReady;
    item._ready = new Promise((resolve) => { markReady = resolve; });
    item._isChained = !file;
    item._metadata = {};
    item._metadataReady = Promise.resolve();

    preview.classList.add("img");
    previewWrap.classList.add("previewWrap");
    actions.classList.add("actions");
    imageWrap.classList.add("imgWrap");
    generalWrap.classList.add("generalWrap");
    buttonWrap.classList.add("btnWrap");
    actionWrap.classList.add("actionsWrap");
    arrayToOptionList(actionOptions, actionSelect);
    actionSelect.required = true;
    actionSelect.addEventListener("change", () => onActionSelectChange(actionSelect));

    previewWrap.appendChild(preview);
    imageWrap.append(previewWrap, document.createTextNode(file?.name || "Chained image"));
    actionWrap.appendChild(actionSelect);
    generalWrap.append(actionWrap, actions);
    runButton.type = removeButton.type = chainButton.type = "button";
    runButton.appendChild(materialIcon("play_arrow", true));
    removeButton.appendChild(materialIcon("delete"));
    chainButton.appendChild(materialIcon("add"));
    buttonWrap.append(runButton, removeButton, chainButton);
    generalWrap.appendChild(buttonWrap);
    item.append(imageWrap, generalWrap);

    if (afterItem) imgsPreview.insertBefore(item, afterItem.nextSibling);
    else imgsPreview.appendChild(item);

    if (file) {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
            renderImageIntoCanvas(image, preview);
            item._originalCanvas = imageToCanvas(preview);
            URL.revokeObjectURL(objectUrl);
            markReady();
        };
        image.src = objectUrl;
        item._metadataReady = getImageMetadata(file)
            .then((result) => { item._metadata = editableMetadata(result.metadata); })
            .catch((error) => console.warn("Unable to read image metadata:", error));
    } else {
        // A chained step begins as an exact copy of the step immediately before it.
        const previous = item.previousElementSibling;
        if (!previous) markReady();
        else {
            previous._ready.then(() => {
                copyCanvas(getInputCanvas(item), preview);
                markReady();
            });
            item._metadataReady = getItemMetadata(previous).then((metadata) => {
                item._metadata = { ...metadata };
            });
        }
    }

    runButton.addEventListener("click", async () => {
        await item._ready;
        runAction(item);
    });
    chainButton.addEventListener("click", () => addAction(item));
    removeButton.addEventListener("click", () => {
        const parent = item.parentElement;
        parent.removeChild(item);
        if (!parent.hasChildNodes()) {
            usedFirstTime = false;
        }
    });
    onActionSelectChange(actionSelect);
}

function runAction(item, settings = {}) {
    const source = getInputCanvas(item);
    let destination = item.querySelector(".imgWrap > .previewWrap > canvas");
    if (!source || !source.width || !source.height) return;

    // Always begin with the source image. This also makes unimplemented actions safe.
    copyCanvas(source, destination);
    const action = item.querySelector(".actionsWrap > select").value;
    switch (action) {
        case "changeCol": {
            const from = item.querySelector(".inputFrom").value.trim();
            const to = item.querySelector(".inputTo").value.trim();
            const percentage = item.querySelector(".inputPc").value;
            if (!from || !to || percentage === "") return;
        
            try {
                const sourceContext = source.getContext("2d", { willReadFrequently: true });
                const result = Action.replaceColor(
                    sourceContext.getImageData(0, 0, source.width, source.height), from, to, percentage
                );
                destination.getContext("2d", { willReadFrequently: true }).putImageData(result, 0, 0);
            } catch (error) {
                console.error("Unable to change colour:", error);
            }
            break;
        };
        case "crop": {
            const l = Number(item.querySelector(".left").value)  || 0;
            const u = Number(item.querySelector(".up").value)    || 0;
            const r = Number(item.querySelector(".right").value) || 0;
            const d = Number(item.querySelector(".down").value)  || 0;
            const cropWidth = source.width - l - r;
            const cropHeight = source.height - u - d;
            if (cropWidth <= 0 || cropHeight <= 0) return;
            destination.width = cropWidth;
            destination.height = cropHeight;
            const context = destination.getContext("2d", { willReadFrequently: true });
            context.drawImage(
                source,
                l, u, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            break;
        };
        case "setSize": {
            const widthInput = item.querySelector(".width");
            const heightInput = item.querySelector(".height");
            const keepRatio = item.querySelector(".ratio").checked;
            let width = Math.round(Number(widthInput.value));
            let height = Math.round(Number(heightInput.value));
            if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) return;
            if (keepRatio && settings.changed === "width") {
                height = Math.max(1, Math.round(source.height * width / source.width));
                heightInput.value = height;
            } else if (keepRatio && settings.changed === "height") {
                width = Math.max(1, Math.round(source.width * height / source.height));
                widthInput.value = width;
            }
            resizeCanvas(source, destination, width, height);
            break;
        };
        case "quality": {
            const newCanvas = Action.scaleCanvas(source, item.querySelector(".percentage").value, item.querySelector(".smoothing").value);
            if (newCanvas) copyCanvas(newCanvas, destination);
        };
    };

}

function onActionSelectChange(select) {
    const actions = select.closest(".generalWrap").querySelector(".actions");
    const liElem = actions.closest("li");
    actions.replaceChildren();
    actions.className = "";
    actions.classList.add("actions");
    switch (select.value) {
        case "changeCol": {
            actions.classList.add("changeCol");
            const from = document.createElement("input");
            const to = document.createElement("input");
            const percentage = document.createElement("input");
            const colorSelect = document.createElement("select");
            from.type = to.type = "text";
            percentage.type = "number";
            percentage.min = 0;
            percentage.max = 100;
            percentage.value = 0;
            from.placeholder = "From";
            to.placeholder = "To";
            percentage.placeholder = "Tolerance %";
            from.classList.add("inputFrom");
            to.classList.add("inputTo");
            percentage.classList.add("inputPc");
            arrayToOptionList(colorTypeOptions, colorSelect);
            actions.append(from, to, percentage, colorSelect);
            break;
        };
        case "crop": {
            let placeholder = 0;
            function addPlaceholder() {
                const res = document.createElement("div");
                res.classList.add("placeholder", "placeholder-" + placeholder);
                placeholder++;
                actions.appendChild(res);
            }
            actions.classList.add("crop");
            const inputLeft = document.createElement("input");
            const inputUp = document.createElement("input");
            const inputRight = document.createElement("input");
            const inputDown = document.createElement("input");
            inputLeft  .type = "number";
            inputLeft  .classList.add("left");
            inputLeft  .placeholder = "Left";
            inputUp    .type = "number";
            inputUp    .classList.add("up");
            inputUp    .placeholder = "Up";
            inputRight .type = "number";
            inputRight .classList.add("right");
            inputRight .placeholder = "Right";
            inputDown  .type = "number";
            inputDown  .classList.add("down");
            inputDown  .placeholder = "Down";
            addPlaceholder();
            actions.appendChild(inputUp);
            addPlaceholder();
            actions.appendChild(inputLeft);
            addPlaceholder();
            actions.appendChild(inputRight);
            addPlaceholder();
            actions.appendChild(inputDown);
            addPlaceholder();
            break;
        };
        case "quality": {
            actions.classList.add("quality");
            const smoothingOptions = ["None", "Low", "Medium", "High"];
            const input = document.createElement("input");
            const smoothingSelect = document.createElement("select");
            smoothingOptions.forEach((option) => {
                const res = document.createElement("option");
                res.textContent = option;
                res.value = option.toLowerCase();
                smoothingSelect.appendChild(res);
            });
            input.type = "number";
            input.value = 100;
            input.placeholder = "Quality%";
            input.classList.add("percentage");
            smoothingSelect.classList.add("smoothing");
            // input.addEventListener("change", (e) => {
            //     const canvas = actions.closest("li").querySelector("canvas.img");
            //     const parent = canvas.parentElement;
            //     const newCanvas = Action.scaleCanvas(canvas, input.value, smoothingSelect.value);
            //     newCanvas.classList.add("img");
            //     parent.replaceChild(newCanvas, canvas);
            // });
            // smoothingSelect.addEventListener("change", (e) => {
            //     const canvas = actions.closest("li").querySelector("canvas.img");
            //     const parent = canvas.parentElement;
            //     const newCanvas = Action.scaleCanvas(canvas, input.value, smoothingSelect.value);
            //     newCanvas.classList.add("img");
            //     parent.replaceChild(newCanvas, canvas);
            // });
            actions.appendChild(input);
            actions.appendChild(smoothingSelect);
            break;
        };
        case "setSize": {
            actions.classList.add("setSize");
            const canvas = actions.closest("li").querySelector("canvas.img");
            const inputHeight = document.createElement("input");
            const inputWidth = document.createElement("input");
            const inputRatio = document.createElement("input");
            const ratioLabel = document.createElement("p");
            const ratioWrap = document.createElement("div");
            inputHeight.type = "number";
            inputHeight.value = canvas.height;
            inputHeight.placeholder = "Height";
            inputHeight.classList.add("height");
            inputWidth.type = "number";
            inputWidth.value = canvas.width;
            inputWidth.placeholder = "Width";
            inputWidth.classList.add("width");
            inputRatio.type = "checkbox";
            inputRatio.checked = true;
            inputRatio.classList.add("ratio");
            ratioLabel.classList.add("ratioLabel");
            ratioLabel.textContent = "Keep ratio";
            ratioWrap.classList.add("ratioWrap");
            ratioWrap.appendChild(ratioLabel);
            ratioWrap.appendChild(inputRatio);
            inputHeight.min = inputWidth.min = 1;
            inputHeight.addEventListener("change", () => runAction(actions.closest("li"), { changed: "height" }));
            inputWidth.addEventListener("change", () => runAction(actions.closest("li"), { changed: "width" }));
            actions.appendChild(inputHeight);
            actions.appendChild(inputWidth);
            actions.appendChild(ratioWrap);
            break;
        };
        case "download": {
            actions.classList.add("download");
            const supportedImgFormats = ["PNG", "JPG", "JPEG", "WEBP", "Base64"];
            const imgTypeSelect = document.createElement("select");
            const downloadBtn = document.createElement("button");
            const copyBtn = document.createElement("button");
            const fileName = document.createElement("input");
            imgTypeSelect.classList.add("types");
            downloadBtn.classList.add("downloadBtn");
            copyBtn.classList.add("copyBtn");
            fileName.classList.add("name");
            supportedImgFormats.forEach(type => {
                const res = document.createElement("option");
                res.textContent = type;
                res.value = type.toLowerCase();
                imgTypeSelect.appendChild(res);
            });
            downloadBtn.appendChild(materialIcon("download"));
            copyBtn.appendChild(materialIcon("content_copy"));
            const exportImage = async () => {
                const canvas = actions.closest("li").querySelector("canvas.img");
                const item = actions.closest("li");
                const metadata = await getItemMetadata(item);
                const format = imgTypeSelect.value === "base64" ? "png" : imgTypeSelect.value;
                const blob = await canvasToExportBlob(canvas, format, metadata);
                return { blob, format, metadata };
            };
            downloadBtn.addEventListener("click", async () => {
                try {
                    const { blob, format } = await exportImage();
                    const name = fileName.value.trim() || "Res Img";
                    if (imgTypeSelect.value === "base64") {
                        downloadBlob(new Blob([await blobToDataUrl(blob)], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
                    } else {
                        downloadBlob(blob, `${name.replace(/\.[^.]+$/, "")}.${format === "jpg" ? "jpg" : format}`);
                    }
                } catch (error) {
                    console.error("Unable to export image:", error);
                }
            });
            copyBtn.addEventListener("click", async () => {
                try {
                    const { blob } = await exportImage();
                    if (imgTypeSelect.value !== "base64") {
                        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                    } else {
                        await navigator.clipboard.writeText(await blobToDataUrl(blob));
                    }
                } catch (error) {
                    console.error("Unable to copy image:", error);
                }
            });
            fileName.type = "text";
            fileName.placeholder = "File name";
            actions.appendChild(fileName);
            actions.appendChild(imgTypeSelect);
            actions.appendChild(downloadBtn);
            actions.appendChild(copyBtn);
            break;
        };
        case "metadata": {
            actions.classList.add("metadata");
            const item = actions.closest("li");
            const fields = ["Title", "Author", "Copyright", "Description"];
            fields.forEach((field) => {
                const input = document.createElement(field === "Description" ? "textarea" : "input");
                input.placeholder = field;
                input.classList.add("metadataField");
                input.classList.add(field);
                getItemMetadata(item).then((metadata) => {
                    if (!input.value) input.value = metadata[field] || "";
                });
                input.addEventListener("input", () => { item._metadata[field] = input.value; });
                actions.appendChild(input);
            });
            const note = document.createElement("small");
            note.textContent = "Metadata is embedded in PNG and JPEG exports; Base64 uses metadata-enabled PNG.";
            //actions.appendChild(note);
            break;
        };
        case "getColors": {
            actions.classList.add("getColors");
            // let colors = [];
            // Action.forEachPixel(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height), (x, y, r, g, b, a, i, data) => {
                //     if (!colors.some((a) => JSON.stringify(a) === JSON.stringify( [r, g, b, a] ))) {
                    //         colors.push( [r, g, b, a] );
                    //     }
                    // });
                    // console.log(colors.length, colors);
            const canvas = liElem.querySelector("canvas.img");
            const context = canvas.getContext("2d");
            const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = new Uint32Array(data.buffer);
            const unique = new Set(pixels);
            //const colors = [];
            const hexes = [];
            let noAlpha = true;
            for (const pixel of unique) {
                hexes.push(pixelToHex(pixel, true));
                if (((pixel >>> 24) & 255).toString(16).padStart(2, "0").toLowerCase() != "ff") noAlpha = false;
                // colors.push([
                //     pixel & 255,
                //     (pixel >>> 8) & 255,
                //     (pixel >>> 16) & 255,
                //     (pixel >>> 24) & 255
                // ]);
            }
            if (hexes.length > 10000) {
                if (!confirm("The amount of colors is " + hexes.length + ", which can be laggy.\nDo you want to proceed?")) return;
            }
            const liIndex = getChildIndex(liElem);
            //console.log("INDEX: ", liIndex);
            const wrap = document.createElement("div");
            wrap.classList.add("colorsWrap");
            hexes.forEach((hex) => {
                const res = document.createElement("div");
                const popover = document.createElement("div");
                const closeBtn = document.createElement("button");
                res.classList.add("color");
                res.setAttribute("colorData", hex);
                res.setAttribute(
                    "colorDataNoSign", 
                    formatHex(
                        !noAlpha ? hex
                        : hex.replace(/ff$/gmi, "")
                    ).replace("#", "").toUpperCase()
                );
                res.addEventListener("click", (e) => {
                    if (!popover.classList.contains("popoverColor-generatedInfo")) {
                        popover.appendChild(addPopoverColorInfo(
                            !noAlpha ? hex
                            : hex.replace(/ff$/gmi, "")
                        ));
                        popover.classList.add("popoverColor-generatedInfo");
                    }
                    popover.showPopover();
                });
                popover.setAttribute("popover", true);
                popover.classList.add("colorPopover");
                closeBtn.classList.add("popover-closeBtn");
                closeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    popover.hidePopover();
                });
                closeBtn.appendChild(materialIcon("close"));
                popover.appendChild(closeBtn);
                //popover.appendChild(colorPWrap);
                res.appendChild(popover);
                wrap.appendChild(res);
            });
            actions.appendChild(wrap);
            break;
                //const elemId = "color-" + liIndex + "-" + hex.replace("#", "");
                //res.setAttribute("popovertarget", elemId);
                //res.setAttribute("popovertargetaction", "show");
        };
    }
}
function addPopoverColorInfo(hex) {
    const res = document.createElement("div");
    const colorPrev = document.createElement("div");
    const colorsWrap = document.createElement("div");
    colorPrev.classList.add("colorPopover-prev");
    colorPrev.setAttribute("colordata", hex);
    res.appendChild(colorPrev);
    colorsWrap.classList.add("colorsWrap");
    const colorPHex =   setPopoverColorData("Hex",   hex, colorsWrap);
    const colorPRGB =   setPopoverColorData("RGB",   hex, colorsWrap);
    const colorPHSL =   setPopoverColorData("HSL",   hex, colorsWrap);
    const colorPHWB =   setPopoverColorData("HWB",   hex, colorsWrap);
    const colorPLab =   setPopoverColorData("Lab",   hex, colorsWrap);
    const colorPLCH =   setPopoverColorData("LCH",   hex, colorsWrap);
    const colorPOklab = setPopoverColorData("Oklab", hex, colorsWrap);
    const colorPOkLCh = setPopoverColorData("OkLCh", hex, colorsWrap);
    res.appendChild(colorsWrap);
    return res;
}
function setPopoverColorData(type, hex, parent) {
    const wrap = document.createElement("div");
    const res = document.createElement("p");
    const label = document.createElement("p");
    wrap.classList.add("wrap");
    res.classList.add("colorPopover-p", type);
    label.classList.add("colorPopover-label", type);
    label.textContent = type;
    const rgba = colorToRGBA(hex);
    switch (type) {
        case "Hex":     { res.textContent = formatHex(hex);                 break; };
        case "RGB":     { res.textContent = formatRGB(rgba);                break; };
        case "HSL":     { res.textContent = formatHSL(rgbaToHSLA(rgba));    break; };
        case "HWB":     { res.textContent = rgbaToHWBAText(rgba);           break; };
        case "Lab":     { res.textContent = rgbaToLabText(rgba);            break; };
        case "LCH":     { res.textContent = toLCHText(rgba);                break; };
        case "Oklab":   { res.textContent = toOkLabText(rgba);              break; };
        case "OkLCh":   { res.textContent = formatOkLCh(rgbaToOkLCh(rgba)); break; };
    };
    res.addEventListener("click", (e) => {
        navigator.clipboard.writeText(res.textContent);
    });
    wrap.appendChild(label);
    wrap.appendChild(res);
    parent.appendChild(wrap);
    return wrap;
}
function formatRGB(rgba) {
    if (rgba.alpha == 1) {
        return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
    }
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b} / ${rgba.alpha})`;
}
function formatHex(hex) {
    hex = hex.replace("#", "").toUpperCase();
    if (hex.length < 6) return "#" + hex;
    if (hex[0] == hex[1] && hex[2] == hex[3] && hex[4] == hex[5] && hex[6] || "" == hex[7] || "")
        return "#" + hex[0] + hex[2] + hex[4] + hex[6] || "";
    return "#" + hex;
}
function formatHSL(hsl) {
    if (hsl.alpha == 1) return `hsl(${hsl.h}, ${hsl.s}, ${hsl.l})`;
    return `hsl(${hsl.h}, ${hsl.s}, ${hsl.l}, ${hsl.alpha})`;
}
function formatOkLCh(oklch) {
    if (oklch.alpha == 1) return `oklch(${oklch.l}, ${oklch.c}, ${oklch.h})`;
    return `oklch(${oklch.l}, ${oklch.c}, ${oklch.h}, ${oklch.alpha})`;
}
function displayDefaultImgs(files) {
    if (usedFirstTime && !confirm("Are you sure you want to upload new images?\nThe old data will be gone!")) return;
    usedFirstTime = true;
    imgsPreview.replaceChildren();
    const file = [...files].filter((file) => file.type.startsWith("image/"))[0];
    if (file) addAction(null, file);
}

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = [...event.dataTransfer.items].map((item) => item.getAsFile()).filter(Boolean);
    displayDefaultImgs(files);
});
window.addEventListener("drop", (event) => {
    if ([...event.dataTransfer.items].some((item) => item.kind === "file")) event.preventDefault();
});
dropZone.addEventListener("dragover", (event) => {
    const fileItems = [...event.dataTransfer.items].filter((item) => item.kind === "file");
    if (fileItems.length) {
        event.preventDefault();
        event.dataTransfer.dropEffect = fileItems.some((item) => item.type.startsWith("image/")) ? "copy" : "none";
    }
});
window.addEventListener("dragover", (event) => {
    if ([...event.dataTransfer.items].some((item) => item.kind === "file")) {
        event.preventDefault();
        if (!dropZone.contains(event.target)) event.dataTransfer.dropEffect = "none";
    }
});
fileInput.addEventListener("change", (event) => displayDefaultImgs(event.target.files));
