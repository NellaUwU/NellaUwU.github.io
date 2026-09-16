import { addHoldEventListener, measureText, css } from "/script/shared.js";
const settings = {
    pixelDensity: 2,
    zoom: { min: .25, max: 4, step: .15 },
    node: {
        body: { fontSize: 16, h0: 4, h1: 3, h2: 2, h3: 1.5, h4: 1.25, h5: 1, h6: .8, h7: .65, h8: .5, h9: .35 }
    }
};
const nav = document.createElement("nav");
const canvas = document.createElement("canvas");
canvas.setAttribute("layoutsubtree", "");
canvas.className = "map-canvas";
document.body.append(nav, canvas);
const camera = { x: 0, y: 0, zoom: 1 };
let view = { width: 1, height: 1, density: 1 };
canvas.height = 500;
canvas.width = 500;

class Node {
    constructor(data) {
        this.nodeElem = this.loadNode(data);
        return this.nodeElem;
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
};

const exampleNodes = [
    {
        color: "#F5A9B8",
        head: "Test Node",
        body: ""
    }
];
const testNode = new Node(exampleNodes[0]);
canvas.appendChild(testNode);
const context = canvas.getContext("2d");
canvas.onpaint = () => {
    context.reset();
    const transform = context.drawElementImage(testNode, 100, 100);
    testNode.style.transform = transform.toString();
}
//const transform = context.drawElementImage(testNode, 0, 0);
//testNode.node.style.transform = transform.toString();
console.log(testNode);
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