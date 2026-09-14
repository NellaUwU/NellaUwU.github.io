import { drawMarkup, measureMarkup, parseMarkup } from "./markup.js";
import { loadMap, saveMap } from "./storage.js";

const settings = {
    zoom: { min: .25, max: 4, step: .15 },
    node: { minWidth: 190, maxWidth: 520, ratio: 4 / 3, padding: 14, headerHeight: 34 },
    body: { fontSize: 16, h0: 4, h1: 3, h2: 2, h3: 1.5, h4: 1.25, h5: 1, h6: .8, h7: .65, h8: .5, h9: .35 }
};
const nav = document.createElement("nav");
const canvas = document.createElement("canvas");
canvas.className = "map-canvas";
document.body.append(nav, canvas);
const ctx = canvas.getContext("2d");
const data = loadMap();
const nodes = data.nodes.map(makeNode);
const connections = data.connections;
const camera = { x: 0, y: 0, zoom: 1 };
let view = { width: 1, height: 1, density: 1 };
let drag, pan, holdTimer, lastHead, connectFrom, autoPanFrame;

function makeNode(data) {
    const node = {
        id: data.id || crypto.randomUUID(),
        pos: Array.isArray(data.pos) ? data.pos : [0, 0],
        color: data.color || "#e7eefb",
        head: data.head || "Untitled",
        body: data.body || "",
        width:  data.width,
        height: data.height
    };
    node.markup = parseMarkup(node.body);
    sizeNode(node);
    return node;
}
function sizeNode(node) {
    const chars = `${node.head}\n${node.body}`.length;
    node.width = Math.round(
        Math.max(settings.node.minWidth,
            Math.min(settings.node.maxWidth,
                node.width || Math.sqrt(Math.max(80, chars * 85 * settings.node.ratio))
    )));
    node.height = Math.max(92,
        Math.ceil(
            settings.node.headerHeight + settings.node.padding * 2 + measureMarkup(
                node.markup, ctx,
                node.width - settings.node.padding * 2,
                settings
            )
    ));
}
function save() {
    connections.forEach(connection => {
        const from = nodes.find(node => node.id === connection.fromId),
              to   = nodes.find(node => node.id === connection.toId);
        if (!Array.isArray(connection.points) || connection.points.length < 2) return;
        if (from)          connection.points[0] = [center(from).x, center(from).y];
        if (to)            connection.points[connection.points.length - 1] = [center(to).x, center(to).y];
    });
    saveMap(nodes.map(({ markup, ...node }) => node), connections);
}
function screenToWorld(point) {
    return {
        x: camera.x + (point.x - view.width  / 2) / camera.zoom,
        y: camera.y - (point.y - view.height / 2) / camera.zoom
    };
}
function worldToScreen(point) {
    return {
        x: view.width  / 2 + (point.x - camera.x) * camera.zoom,
        y: view.height / 2 - (point.y - camera.y) * camera.zoom };
    }
function nodeAt(point) {
    return [...nodes].reverse().find(node =>
           point.x >= node.pos[0]
        && point.x <= node.pos[0] + node.width
        && point.y <= node.pos[1]
        && point.y >= node.pos[1] - node.height
    );
}
function headerAt(point) {
    const node = nodeAt(point);
    return node && point.y >= node.pos[1] - settings.node.headerHeight ? node : null;
}
function center(node) {
    return {
        x: node.pos[0] + node.width  / 2,
        y: node.pos[1] - node.height / 2
    };
}
function resize() {
    view = {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        density: devicePixelRatio || 1
    };
    canvas.width  = Math.round(view.width * view.density);
    canvas.height = Math.round(view.height * view.density);
    render();
}
new ResizeObserver(resize).observe(canvas);
function zoom(value, point = { x: view.width / 2, y: view.height / 2 }) {
    const before = screenToWorld(point);
    camera.zoom = Math.max(settings.zoom.min, Math.min(settings.zoom.max, value));
    const after = screenToWorld(point);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    render();
}

function drawConnection(connection) {
    if (!connection.points || connection.points.length < 2) return;
    const points = connection.points.map(point => [...point]);
    const from   = nodes.find(node => node.id === connection.fromId),
          to     = nodes.find(node => node.id === connection.toId);
    if (from) points[0] = [center(from).x, center(from).y];
    if (to)   points[points.length - 1] = [center(to).x, center(to).y];
    ctx.save();
    ctx.beginPath();
    points.forEach(([x, y], i) => {
        const p = worldToScreen({ x, y });
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = connection.color || "#334155";
    ctx.lineWidth = 2;
    ctx.setLineDash(connection.style === "dashed"
        ? [8, 6]
        : connection.style === "dotted" ? [2, 5] : []
    );
    ctx.stroke();
    ctx.restore();
}
function drawNode(node) {
    const top = worldToScreen({ x: node.pos[0], y: node.pos[1] });
    const x = top.x,
          y = top.y - node.height * camera.zoom,
          width  = node.width  * camera.zoom,
          height = node.height * camera.zoom,
          head = settings.node.headerHeight * camera.zoom;
    ctx.save();
    ctx.shadowColor = "#0003";
    ctx.shadowBlur = 9;
    ctx.fillStyle = node.color;
    ctx.fillRect(x, y, width, height);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x, y, width, head);
    ctx.fillStyle = "white";
    ctx.font = `600 ${16 * camera.zoom}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(node.head, x + 10 * camera.zoom, y + head / 2);
    ctx.textBaseline = "alphabetic";
    drawMarkup(node.markup, ctx, {
        x: x + settings.node.padding * camera.zoom,
        y: y + head  + settings.node.padding *     camera.zoom,
        width: width - settings.node.padding * 2 * camera.zoom
    }, settings, camera.zoom, render);
    ctx.restore();
}
function render() {
    ctx.setTransform(view.density, 0, 0, view.density, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect (0, 0, view.width, view.height);
    connections.forEach(drawConnection);
    nodes.forEach(drawNode);
    console.log(connectFrom);
    if (connectFrom) {
        const p = worldToScreen(center(connectFrom));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#2563eb";
        ctx.fill();
    }
}
function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}
function startDrag(node, point, pointerId) {
    const world = screenToWorld(point);
    drag = {
        node,
        pointerId,
        point,
        offsetX: world.x - node.pos[0],
        offsetY: world.y - node.pos[1]
    };
    canvas.setPointerCapture(pointerId);
    closeEditor();
    cancelAnimationFrame(autoPanFrame);
    autoPanFrame = requestAnimationFrame(autoPan);
}
function moveDrag(point) {
    const edge = 48;
    let dx = 0,
        dy = 0;
    if (point.x < edge)               dx = -(edge - point.x) / 8 / camera.zoom;
    if (point.x > view.width - edge)  dx = (edge - (view.width - point.x)) / 8 / camera.zoom;
    if (point.y < edge)               dy = (edge - point.y) / 8 / camera.zoom;
    if (point.y > view.height - edge) dy = -(edge - (view.height - point.y)) / 8 / camera.zoom;
    camera.x += dx;
    camera.y += dy;
    const world = screenToWorld(point);
    drag.node.pos = [world.x - drag.offsetX, world.y - drag.offsetY];
    render();
}
function autoPan() {
    if (!drag) return;
    moveDrag(drag.point);
    autoPanFrame = requestAnimationFrame(autoPan);
}
canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = eventPoint(event),
          world = screenToWorld(point),
          node = nodeAt(world),
          header = headerAt(world);
    if (header && event.pointerType === "mouse" && lastHead?.node === header && performance.now() - lastHead.time < 350) {
        lastHead = null;
        startDrag(header, point, event.pointerId);
        return;
    }
    pan = { pointerId: event.pointerId, point, start: point, node, header }; canvas.setPointerCapture(event.pointerId);
    if (header && event.pointerType !== "mouse") holdTimer = setTimeout(() => startDrag(header, point, event.pointerId), 450);
});
canvas.addEventListener("pointermove", event => {
    const point = eventPoint(event);
    if (drag?.pointerId === event.pointerId) {
        drag.point = point;
        moveDrag(point);
        return;
    }
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (Math.hypot(point.x - pan.start.x, point.y - pan.start.y) > 7) clearTimeout(holdTimer);
    if (!pan.node) { camera.x -= (point.x - pan.point.x) / camera.zoom; camera.y += (point.y - pan.point.y) / camera.zoom; render(); } pan.point = point;
});
canvas.addEventListener("pointerup", event => {
    clearTimeout(holdTimer);
    const point = eventPoint(event), activePan = pan;
    if (drag?.pointerId === event.pointerId) {
        drag = null;
        cancelAnimationFrame(autoPanFrame);
        save();
    }
    else if (activePan?.pointerId === event.pointerId && Math.hypot(point.x - activePan.start.x, point.y - activePan.start.y) < 7) {
        if (activePan.header && event.pointerType === "mouse") {
            lastHead = { node: activePan.header, time: performance.now() }; setTimeout(() => { if (lastHead?.node === activePan.header) { activateNode(activePan.header); lastHead = null; } }, 360);
        } else if (activePan.node) activateNode(activePan.node);
    }
    pan = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", () => {
    clearTimeout(holdTimer);
    drag = null;
    cancelAnimationFrame(autoPanFrame);
    pan = null;
});
canvas.addEventListener("wheel", event => {
    event.preventDefault();
    zoom(camera.zoom + (event.deltaY < 0 ? settings.zoom.step : -settings.zoom.step), eventPoint(event));
}, { passive: false });

const editor = document.createElement("form");
editor.className = "node-editor";
editor.innerHTML = `<label>Heading<input name="head" required></label><label>Content<textarea name="body" rows="8"></textarea></label><div class="editor-options"><label>Colour<input name="color" type="color"></label><label>Width<input name="width" type="number" min="190" max="520"></label></div><p>Markup is saved as typed. Click outside this panel to save.</p>`;
document.body.append(editor);
let editing;
function openEditor(node) {
    editing = node;
    editor.head.value  = node.head;
    editor.body.value  = node.body;
    editor.color.value = /^#[0-9a-f]{6}$/i.test(node.color) ? node.color : "#e7eefb";
    editor.width.value = node.width;
    editor.classList.add("open");
    camera.x = center(node).x;
    camera.y = center(node).y;
    zoom(Math.max(camera.zoom, 1.1));
    editor.head.focus();
}
function closeEditor() {
    if (!editing) return;
    editing.head   = editor.head.value.trim() || "Untitled";
    editing.body   = editor.body.value;
    editing.color  = editor.color.value;
    editing.width  = Number(editor.width.value) || settings.node.minWidth;
    editing.markup = parseMarkup(editing.body);
    sizeNode(editing);
    editing = null;
    editor.classList.remove("open");
    save();
    render();
}
document.addEventListener("pointerdown", event => {
    if (editing && !editor.contains(event.target)) closeEditor();
});
editor.addEventListener("submit", event => {
    event.preventDefault();
    closeEditor();
});
function addConnection(from, to) {
    connections.push({
        fromId: from.id,
        toId: to.id,
        points: [
            [center(from).x, center(from).y],
            [center(to).x, center(to).y]
        ],
        color: connectionColor.value,
        style: connectionStyle.value
    });
    save();
}
function activateNode(node) {
    if (connectFrom) {
        if (connectFrom !== node) addConnection(connectFrom, node);
        connectFrom = null;
        nav.querySelector(".active")?.classList.remove("active");
        render();
        return;
    }
    openEditor(node);
}
function addButton(label, title, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", action);
    nav.append(button);
    return button;
}
addButton("+ Node", "Add a node", () => {
    const node = makeNode({
        pos: [camera.x - 100, camera.y + 70],
        head: "New node",
        body: ""
    });
    nodes.push(node);
    save();
    openEditor(node);
    render();
});
addButton("-", "Zoom out", () => zoom(camera.zoom - settings.zoom.step));
addButton("+", "Zoom in",  () => zoom(camera.zoom + settings.zoom.step));
const connectButton = addButton("Connect", "Select two nodes to connect", () => {
    connectFrom = connectFrom ? null : { selecting: true };
    connectButton.classList.toggle("active", Boolean(connectFrom));
    render();
});
const connectionColor = document.createElement("input");
connectionColor.type  = "color";
connectionColor.value = "#334155";
connectionColor.title = "New connection colour";
const connectionStyle = document.createElement("select");
connectionStyle.title = "New connection style";
["solid", "dashed", "dotted"].forEach(value => {
    const option = new Option(value, value);
    connectionStyle.append(option);
});
nav.append(connectionColor, connectionStyle);
addButton("Style", "Set preferred node ratio", () => {
    const value = prompt("Preferred width / height ratio (for example 4/3)", "4/3");
    const parts = value ? value.split("/").map(Number) : [];
    const [a, b] = parts;
    if (Number.isFinite(a) && Number.isFinite(b) && b) {
        settings.node.ratio = a / b;
        nodes.forEach(sizeNode);
        save();
        render();
    }
});
addButton("Help", "Map controls", () => alert("Click a node to edit it. Double-click a header with a mouse, or hold a header on touch, to drag. Dragging at an edge auto-pans. Use Connect, then click two nodes."));
const rawActivate = activateNode;
activateNode = node => {
    if (connectFrom?.selecting) {
        connectFrom = node;
        connectButton.classList.add("active");
        render();
        return;
    }
    rawActivate(node);
};
resize();
render();
