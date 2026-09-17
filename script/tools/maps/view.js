import { addHoldEventListener, measureText, css, loadURLQuery, materialIcon, cssToRgba } from "/script/shared.js";
import { Project } from "/script/tools/maps/shared.js";
const settings = {
    pixelDensity: 2,
    zoom: { min: .25, max: 4, step: .15 },
    node: {
        body: { fontSize: 16, h0: 4, h1: 3, h2: 2, h3: 1.5, h4: 1.25, h5: 1, h6: .8, h7: .65, h8: .5, h9: .35 }
    }
};
const formatSettings = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    colorT: "#FFF",
    colorB: "#0000",
    align: "left",
    font: "arial",
    size: -1
};
function addToolbarEntry(name, icon, onclick) {
    const res = materialIcon(icon);
    res.classList.add(name.toLowerCase());
    res.addEventListener("click", e => onclick(e));
    return res;
}
function pixelToHex(pixel, alpha = false) {
    const [r, g, b, a] = pixel;

    const hexR = r.toString(16).padStart(2, "0");
    const hexG = g.toString(16).padStart(2, "0");
    const hexB = b.toString(16).padStart(2, "0");

    if (!alpha) return `#${hexR}${hexG}${hexB}`;

    const hexA = a.toString(16).padStart(2, "0");
    return `#${hexR}${hexG}${hexB}${hexA}`;
}
function createNav() {
    function runAction(e, type) {
        if (type == "toggle"){
            e.target.classList.toggle("active");
            return;
        }
        if (type == "color") {
            const color = "#" + (prompt("Color:") ?? "000");
            const rgba = [...cssToRgba(color)];
            const hex = pixelToHex(rgba, false);
            console.log(`${hex}`);
            e.target.style.color = `${hex}`;
        }
    }
    const fontSizes = ["H0", "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9"];
    const fontFams  = [
        { name: "Arial", value: "arial" },
        { name: "Sans-Serif", value: "sans-serif"},
        { name: "Lexend", value: "\"Lexend\""}
    ];
    const res =             document.createElement("nav");
    const menu =            materialIcon("account_circle");//document.createElement("div");
    menu.addEventListener("click", e => {
        project.saveAllNodes();
    });
    const tools =           document.createElement("ul");
    const hidden =          document.createElement("div");
    const fontSize =        addToolbarEntry("FontSize", "format_size",   () => fontSizeFunc.showPicker());
    const fontFam  =        addToolbarEntry("FontFam",  "font_download", () => fontFamFunc .showPicker());
    const fontSizeFunc =    document.createElement("select");
    const fontFamFunc  =    document.createElement("select");
    const textAlnFunc  =    document.createElement("select");
    const bold =            addToolbarEntry("Bold",         "format_bold",       e => runAction(e, "toggle"));
    const ital =            addToolbarEntry("Italic",       "format_italic",     e => runAction(e, "toggle"));
    const under =           addToolbarEntry("Underline",    "format_underlined", e => runAction(e, "toggle"));
    const strike =          addToolbarEntry("Strike",       "strikethrough_s",   e => runAction(e, "toggle"));
    const colorT =          addToolbarEntry("TextC",        "format_color_text", e => runAction(e, "color"));
    const colorB =          addToolbarEntry("BgC",          "format_color_fill", e => runAction(e, "color"));
    const link =            addToolbarEntry("Link",         "link",              e => runAction(e, "menu"));
    const align =           addToolbarEntry("Align",        "format_align_left", () => textAlnFunc.showPicker());
    const unreWrap =        document.createElement("div");
    const undo = addToolbarEntry("Undo", "undo", e => {});
    const redo = addToolbarEntry("Redo", "redo", e => {});
    unreWrap.classList.add("unrewrap");
    fontSizes.forEach(entry => {
        const opt = document.createElement("option");
        opt.textContent = entry,
        opt.value = entry.toLowerCase();
        fontSizeFunc.appendChild(opt);
    });
    fontFams.forEach(entry => {
        const opt = document.createElement("option");
        opt.textContent = entry.name,
        opt.value = entry.value;
        fontFamFunc.appendChild(opt);
    });
    function createOption(name, value) {
        const res = document.createElement("option");
        res.textContent = name;
        res.value = value ?? name.toLowerCase();
        return res;
    }
    textAlnFunc.append(createOption("Left"), createOption("Center"), createOption("Right"), createOption("Justify"));
    textAlnFunc.addEventListener("change", e => {
        const selectedValue = e.target.value;
        align.textContent = "format_align_" + selectedValue;
    });
    menu .classList.add("menu");
    tools.classList.add("tools");
    hidden.classList.add("hidden");
    unreWrap.append(undo, redo);
    hidden.append(fontSizeFunc, fontFamFunc, textAlnFunc);
    tools.append(fontSize, fontFam, bold, ital, under, strike, colorT, colorB, link, align, unreWrap, hidden);
    res.append(menu, tools);
    return res;
}
class Node {
    constructor(data) {
        this.json = data;
        this.nodeElem = this.loadNode(data);
    }
    getTools() {
        const res = document.createElement("div");
        res.classList.add("tools");
        return res;
    }
    loadNode(data) {
        const res  = document.createElement("div");
        const head = document.createElement("div");
        const body = document.createElement("div");
        const capt = document.createElement("p");
        //const tools = this.getTools();
        let open = false;
        res .classList.add("node");
        head.classList.add("head");
        body.classList.add("body");
        capt.textContent = data.head;
        head.appendChild(capt);
        res.append(head, body);
        res.setAttribute("drawable", "");
        res.setAttribute("node-color", data.color);
        body.setAttribute("contenteditable", "");
        body.setAttribute("autocomplete", "off");
        body.setAttribute("autocorrect", "off");
        body.setAttribute("autocapitalize", "off");
        body.setAttribute("spellcheck", "false");
        head.addEventListener("click", e => {
            open = !open;
            if (open) {
                res.classList.add("open");
            }
            else {
                res.classList.remove("open");
            }
        });
        function resize() {
            /*const previousWidth = body.style.width;
            const previousWhiteSpace = body.style.whiteSpace;
            body.style.width = "max-content";
            body.style.whiteSpace = "nowrap";
            const contentWidth = body.scrollWidth + 16;
            body.style.whiteSpace = previousWhiteSpace;
            body.style.width = previousWidth;
            //console.log(contentWidth, 512, head.clientWidth);
            const width = Math.max(Math.min(contentWidth, 512), head.clientWidth);
            res.style.width = `${width}px`;
            if (open) res.style.height = `${body.scrollHeight + head.offsetHeight}px`;
            else res.style.height = `calc(var(--_captionHeight) + 2 * var(--_captionPaddingBlock))`;*/
            const previousWidth = body.style.width;
            const previousWhiteSpace = body.style.whiteSpace;
            const size = measureText(body.textContent, css(body, "font"));
            const headBox = head.getBoundingClientRect();
            const contentWidth = size;
            body.style.whiteSpace = previousWhiteSpace;
            body.style.width = previousWidth;
            const width = Math.max(Math.min(contentWidth, 512), head.clientWidth);
            res.style.width = `${width}px`;
            if (open) {
                res.style.height = "auto";
                res.style.height = `${headBox.height + 2 * css(body, "padding-block") + size.h}px`;
            } else res.style.height = `calc(var(--_captionHeight) + 2 * var(--_captionPaddingBlock))`;
        }
        // addHoldEventListener(res, {
        //     onClick(e) {
        //         res.classList.toggle
        //     },
        //     onHold(e) {
        //         alert("TESTE");
        //     }
        // }, 500);
        const observer = new ResizeObserver(() => resize());
        // body.addEventListener("beforeinput", e => {
        //     if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') resize();
        // });
        body.addEventListener("input", e => {
            resize()
            // res.style.height = "auto";
            // res.style.height = `px`;
        });
        observer.observe(body);
        return res;
    }
    render(context) {
        const pos = this.json.pos;
        //console.log(this.nodeElem);
        const transform = context.drawElementImage(this.nodeElem, pos.x, pos.y);
        this.nodeElem.style.transform = transform.toString();
    }
};

const nav = createNav();
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");
canvas.setAttribute("layoutsubtree", "");
canvas.className = "map-canvas";
document.body.append(nav, canvas);
const camera = { x: 0, y: 0, zoom: 1 };
let view = { width: 1, height: 1, density: 1 };
canvas.height = 500;
canvas.width = 500;

let project = new Project(loadURLQuery("m"));
console.log(loadURLQuery("m"), project)
console.dir(project.get().nodes);
project.get().nodes.forEach(node => {
    const n = new Node(node);
    canvas.appendChild(n.nodeElem);
    //n.render(context);
    project.createNode(n.nodeElem, n);
    project.saveAllNodes();
});
console.log(project.nodes);

canvas.onpaint = () => {
    context.reset();
    project.nodes.forEach(node => node.render(context));

    const transform = context.drawElementImage(testNode.nodeElem, 100, 100);
    testNode.nodeElem.style.transform = transform.toString();
}
//const transform = context.drawElementImage(testNode, 0, 0);
//testNode.node.style.transform = transform.toString();
//document.body.appendChild(testNode);

function updateCanvasSize() {
    canvas.height = canvas.clientHeight * settings.pixelDensity;
    canvas.width  = canvas.clientWidth  * settings.pixelDensity;
}
window.addEventListener("load", e => {
    updateCanvasSize();
});
window.addEventListener("resize", e => {
    updateCanvasSize();
});

const exampleNodes = [
    {
        color: "#F5A9B8",
        head: "Test Node",
        body: ""
    }
];
const testNode = new Node(exampleNodes[0]);
canvas.appendChild(testNode.nodeElem);
