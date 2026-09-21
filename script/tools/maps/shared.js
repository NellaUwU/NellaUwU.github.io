import { addHoldEventListener, measureText, css, loadURLQuery, materialIcon, cssToRgba } from "/script/shared.js";
function parseNodeData(data) {
    // Escape first: only documented map-markup is allowed to create DOM nodes.
    // This keeps ordinary angle brackets from being consumed by the HTML parser.
    let res = String(data ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\\n/g, "<br>")
        .replace(/\r\n?|\n/g, "<br>");

    return res
        .replace(/&lt;h([0-9])&gt;/gi, (_, size) => `<p class="heading" hSize="${size}">`)
        .replace(/&lt;\/h[0-9]&gt;/gi, "</p>")
        .replace(/&lt;l([bnlgd])&gt;/gi, (_, type) => `<p class="list" lType="${type.toLowerCase()}">`)
        .replace(/&lt;\/l[bnlgd]&gt;/gi, "</p>")
        .replace(/&lt;font\s+src=&quot;([^]*?)&quot;\s*&gt;/gi, (_, src) => `<span class="font" fSrc="${src}">`)
        .replace(/&lt;\/font&gt;/gi, "</span>")
        .replace(/&lt;b&gt;/gi, "<b>")
        .replace(/&lt;\/b&gt;/gi, "</b>")
        .replace(/&lt;i&gt;/gi, "<i>")
        .replace(/&lt;\/i&gt;/gi, "</i>")
        .replace(/&lt;u&gt;/gi, "<u>")
        .replace(/&lt;\/u&gt;/gi, "</u>")
        .replace(/&lt;s&gt;/gi, "<s>")
        .replace(/&lt;\/s&gt;/gi, "</s>")
        .replace(/&lt;c\s+col=&quot;([^]*?)&quot;(?:\s+type=&quot;([^]*?)&quot;)?\s*&gt;/gi, (_, color, type) => `<span class="color" col="${color}"${type ? ` type="${type}" style="background-color: ${color}"` : ` style="color: ${color}"`}>`)
        .replace(/&lt;\/c&gt;/gi, "</span>")
        .replace(/&lt;sp&gt;/gi, "<sup>")
        .replace(/&lt;\/sp&gt;/gi, "</sup>")
        .replace(/&lt;sb&gt;/gi, "<sub>")
        .replace(/&lt;\/sb&gt;/gi, "</sub>")
        .replace(/&lt;align\s+align=&quot;(left|center|right|justify|block)&quot;\s*&gt;/gi, (_, type) => `<div class="align" aType="${type.toLowerCase() === "block" ? "justify" : type.toLowerCase()}">`)
        .replace(/&lt;\/align&gt;/gi, "</div>")
        .replace(/&lt;code&gt;/gi, '<p class="code">')
        .replace(/&lt;\/code&gt;/gi, "</p>")
        .replace(/&lt;link\s+href=&quot;([^]*?)&quot;\s*&gt;/gi, (_, href) => `<a href="${href}" target="_blank">`)
        .replace(/&lt;\/link&gt;/gi, "</a>")
        .replace(/&lt;img\s+src=&quot;([^]*?)&quot;\s*\/?&gt;/gi, (_, src) => `<img src="${src}">`)
        .replace(/&lt;vid\s+src=&quot;([^]*?)&quot;\s*&gt;/gi, (_, src) => `<video src="${src}" controls>`)
        .replace(/&lt;\/vid&gt;/gi, "</video>");
}
function compileNodeData(elem) {
    if (!elem) return "";

    function compile(element) {
        if (element.nodeType === 3) return element.textContent.replace(/\u200B/g, "");
        if (element.nodeType !== 1) return "";

        const content = Array.from(element.childNodes, compile).join("");
        const tag = element.tagName.toLowerCase();
        if (tag === "br") return "\\n";
        const headingSize = tag.match(/^h([0-9])$/)?.[1]
            ?? (element.classList.contains("heading") ? element.getAttribute("hsize") : null);
        if (headingSize !== null && headingSize !== undefined)
            return `<h${headingSize}>${content}</h${headingSize}>`;
        const listType = element.classList.contains("list") ? element.getAttribute("ltype") : null;
        if (listType !== null && listType !== undefined)
            return `<l${listType}>${content}</l${listType}>`;
        if (element.classList.contains("font"))
            return `<font src="${element.getAttribute("fsrc") ?? ""}">${content}</font>`;
        if (["b", "i", "u", "s"].includes(tag))
            return `<${tag}>${content}</${tag}>`;
        if (tag === "span" && element.classList.contains("color")) {
            const type = element.getAttribute("type");
            return `<c col="${element.getAttribute("col") ?? ""}"${type ? ` type="${type}"` : ""}>${content}</c>`;
        }
        if (tag === "sup") return `<sp>${content}</sp>`;
        if (tag === "sub") return `<sb>${content}</sb>`;
        if (element.classList.contains("align"))
            return `<align align="${element.getAttribute("atype") ?? "left"}">${content}</align>`;
        if (element.classList.contains("code"))
            return `<code>${content}</code>`;
        if (tag === "a")
            return `<link href="${element.getAttribute("href") ?? ""}">${content}</link>`;
        if (tag === "img")
            return `<img src="${element.getAttribute("src") ?? ""}>`;
        if (tag === "video")
            return `<vid src="${element.getAttribute("src") ?? ""}">${content}</vid>`;
        if (tag === "br") return "<br>";
        return content;
    }

    return Array.from(elem.childNodes, compile).join("");
}
export class Node {
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
        let open = data.open === undefined ? Boolean(data.body) : Boolean(data.open);
        res .classList.add("node");
        head.classList.add("head");
        body.classList.add("body");
        capt.textContent = data.head;
        body.innerHTML = parseNodeData(data.body);
        head.appendChild(capt);
        res.append(head, body);
        res.setAttribute("drawable", "");
        res.setAttribute("node-color", data.color ?? "#F5A9B8");
        body.setAttribute("contenteditable", "");
        body.setAttribute("autocomplete", "off");
        body.setAttribute("autocorrect", "off");
        body.setAttribute("autocapitalize", "off");
        body.setAttribute("spellcheck", "false");
        res.classList.toggle("open", open);
        res.addEventListener("click", e => {
            console.log("Node clicked:", e.target, e.currentTarget);
            setLastClickOnNode(true);
        });
        head.addEventListener("click", e => {
            console.log("Node head clicked:", e.target, e.currentTarget);
            setLastClickOnNode(true);
            open = !open;
            if (open) {
                res.classList.add("open");
            }
            else {
                res.classList.remove("open");
            }
        });
        function resize() {
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
        const observer = new ResizeObserver(() => resize());
        body.addEventListener("input", e => {
            resize();
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
export class Project {
    constructor(id) {
        this.pId = id;
        this.nodes = new Map();
        this.project = this.readProject();
    }
    readProject() {
        const raw = localStorage.getItem(`maps/projects/${this.pId}`);
        if (!raw) return { name: `Project ${this.pId}`, color: "#d8b989", nodes: [] };
        try {
            const project = JSON.parse(raw);
            if (!project || typeof project !== "object") throw new Error("Invalid project");
            if (!Array.isArray(project.nodes)) project.nodes = [];
            project.nodes = project.nodes.map(entry => {
                if (Array.isArray(entry) && entry[1] && typeof entry[1] === "object") {
                    entry = { ...entry[1], id: entry[1].id ?? entry[0] };
                }
                if (!entry || typeof entry !== "object") return null;
                return {
                    id: entry.id,
                    pos: entry.pos && typeof entry.pos === "object" ? entry.pos : { x: 0, y: 0 },
                    color: entry.color ?? "#F5A9B8",
                    head: entry.head ?? "Untitled",
                    body: entry.body ?? "",
                    ...(entry.open === undefined ? {} : { open: Boolean(entry.open) })
                };
            }).filter(entry => entry && typeof entry === "object");
            return project;
        } catch (error) {
            console.warn(`Could not load map project ${this.pId}; using an empty project.`, error);
            return { name: `Project ${this.pId}`, color: "#d8b989", nodes: [] };
        }
    }
    reload() {
        this.project = this.readProject();
        return this.project;
    }
    save() {
        localStorage.setItem(`maps/projects/${this.pId}`, JSON.stringify(this.project));
    }
    get() {
        return this.project;
    }
    saveNode(elem, local = true) {
        const id = elem.getAttribute("nodeId");
        const data = this.nodes.get(id);
        if (!data) return;
        data.json.body = compileNodeData(elem.querySelector(".body"));
        data.json.open = elem.classList.contains("open");
        this.nodes.set(id, data);
        if (local) {
            this.project.nodes = Array.from(this.nodes.values(), node => ({ ...node.json }));
            this.save();
        }
    }
    saveAllNodes() {
        this.nodes.forEach(node => this.saveNode(node.nodeElem, false));
        this.project.nodes = Array.from(this.nodes.values(), node => ({ ...node.json }));
        this.save();
    }
    deleteNode(elem) {
        const id = elem.getAttribute("nodeId");
        this.nodes.delete(id);
    }
    createNode(elem, data) {
        const id = data.json.id ?? this.generateId();
        data.json.id = id;
        elem.setAttribute("nodeId", id);
        this.nodes.set(id, data);
        return id;
    }
    generateId() {
        let id;
        do {
            if (crypto.randomUUID) {
                id = crypto.randomUUID();
            } else {
                id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
        } while (this.nodes.has(id));
        return id;
    }
};
let isLastClickOnNode = false;
export function getLastClickOnNode() {
    return isLastClickOnNode;
}
export function setLastClickOnNode(value, remove = false) {
    isLastClickOnNode = value;
    if (remove) {
        setTimeout(() => {
            isLastClickOnNode = false;
        }, 3000);
    }
}
// window.addEventListener("click", e => {
//     console.log(e);
//     console.log(e.target);
//     console.log(e.target.closest(".node"));
//     console.log("pseudoTarget:", e.pseudoTarget);
//     console.log({
//         target: e.target,
//         pseudoTarget: e.pseudoTarget,
//         x: e.offsetX,
//         y: e.offsetY,
//         e: e
//     });
// });