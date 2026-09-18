import { addHoldEventListener, measureText, css, loadURLQuery, materialIcon, cssToRgba } from "/script/shared.js";
function parseNodeData(json) {
    const data = json;
    const res = document.createElement("p");
    // Will later parse the body data and return the DOM
    res.textContent = data ?? "";
    return res;
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
        let open = false;
        res .classList.add("node");
        head.classList.add("head");
        body.classList.add("body");
        capt.textContent = data.head;
        body.innerHTML = "";
        body.appendChild(parseNodeData(data.body));
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
        this.project = localStorage.getItem(`maps/projects/${this.pId}`);
        return this.project;
    }
    reload() {
        this.project = localStorage.getItem(`maps/projects/${this.pId}`);
        return this.project;
    }
    save(stringify = true) {
        const data = this.project;
        console.log(this.project);
        if (stringify) localStorage.setItem(`maps/projects/${this.pId}`, JSON.stringify(data));
        else           localStorage.setItem(`maps/projects/${this.pId}`, data);
        //console.error("SAVING..", stringify, this.project);
    }
    get() {
        return JSON.parse(this.project);
    }
    saveNode(elem, local = true) {
        const id = elem.getAttribute("nodeId");
        const data = this.nodes.get(id);
        console.log(data);
        //console.log(elem.querySelector(".body").textContent);
        data.json.body = elem.querySelector(".body").textContent ?? "";
        this.nodes.set(id, data);
        if (local) {
            this.project.nodes = Array.from(this.nodes);
            this.save();
        }
    }
    saveAllNodes() {
        this.nodes.forEach(node => {
            //console.log(node);
            this.saveNode(node.nodeElem, false);
        });
        if (typeof this.project === "string") this.project = JSON.parse(this.project);
        let n = [];
        this.nodes.forEach(m => {
            console.log(m);
            // const j = m.json[1].json;
            // j.id = m.json[0];
            const j = m.json;
            j.id = m.json.id;
            n.push(j);
        });
        this.project.nodes = n;
        this.save(true);
    }
    deleteNode(elem) {
        const id = elem.getAttribute("nodeId");
        this.nodes.delete(id);
    }
    createNode(elem, data) {
        const id = this.generateId();
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
console.log(JSON.stringify({
        pos: {
            x: 300,
            y: 150
        },
        color: "#F5A9B8",
        head: "Test Node",
        body: ""
    }));
const test = "{\"name\":\"New Project #0\",\"color\":\"#d8b989\",\"nodes\":[{\"pos\":{\"x\":300,\"y\":150},\"color\":\"#F5A9B8\",\"head\":\"Test Node\",\"body\":\"\"}]}";
console.log(JSON.parse(test));