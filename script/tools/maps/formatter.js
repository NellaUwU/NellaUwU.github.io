const TAGS = {
    bold: { tag: "b", icon: "bold" },
    italic: { tag: "i", icon: "italic" },
    underline: { tag: "u", icon: "underline" },
    strike: { tag: "s", icon: "strike" }
};
const DEBUG_FORMATTER = true;

function debugFormat(stage, details = {}) {
    if (DEBUG_FORMATTER) console.log(`[formatter:${stage}]`, details);
}

function getBody(range, root) {
    let element = range?.commonAncestorContainer;
    if (element?.nodeType !== 1) element = element?.parentElement;
    return element?.closest(".body") ?? (root?.classList.contains("body") ? root : null);
}

function elementAt(container, body, matcher) {
    let element = container.nodeType === 1 ? container : container.parentElement;
    while (element && element !== body) {
        if (matcher(element)) return element;
        element = element.parentElement;
    }
    return null;
}

function selectionTextRange(selection, root) {
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return getBody(range, root) ? range : null;
}

function setCaret(node, offset) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function setSelection(range) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function sameElementType(first, second) {
    if (!first || !second || first.nodeType !== 1 || second.nodeType !== 1) return false;
    if (first.tagName !== second.tagName || first.attributes.length !== second.attributes.length) return false;
    return Array.from(first.attributes).every(attribute =>
        second.getAttribute(attribute.name) === attribute.value
    );
}

function mergeAdjacent(element) {
    let current = element;
    if (sameElementType(current.previousElementSibling, current)) {
        const previous = current.previousElementSibling;
        while (current.firstChild) previous.appendChild(current.firstChild);
        current.remove();
        current = previous;
    }
    if (sameElementType(current, current.nextElementSibling)) {
        const next = current.nextElementSibling;
        while (next.firstChild) current.appendChild(next.firstChild);
        next.remove();
    }
    return current;
}

function unwrapSameType(root, wrapper) {
    Array.from(root.querySelectorAll(wrapper.tagName.toLowerCase())).reverse().forEach(element => {
        if (sameElementType(element, wrapper)) element.replaceWith(...element.childNodes);
    });
}

function wrapRange(range, tag, attributes = {}) {
    if (!range) return null;
    const wrapper = document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => wrapper.setAttribute(name, value));
    if (range.collapsed) {
        const previous = range.startContainer.nodeType === 1
            ? range.startContainer.childNodes[range.startOffset - 1]
            : null;
        if (previous?.nodeType === 1 && previous.tagName.toLowerCase() === tag) {
            const marker = document.createTextNode("\u200B");
            previous.appendChild(marker);
            setCaret(marker, 0);
            return previous;
        }
        range.insertNode(wrapper);
        const marker = document.createTextNode("\u200B");
        wrapper.appendChild(marker);
        setCaret(marker, 0);
        return wrapper;
    }
    const fragment = range.extractContents();
    unwrapSameType(fragment, wrapper);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    const merged = mergeAdjacent(wrapper);
    const selected = document.createRange();
    selected.selectNodeContents(merged);
    setSelection(selected);
    return merged;
}

function wrapRangeInsideAlignLines(range, tag, attributes = {}, body) {
    const lines = Array.from(body.children).filter(element =>
        element.classList.contains("align") && range.intersectsNode(element)
    );
    if (!lines.length) return wrapRange(range, tag, attributes);

    const wrappers = [];
    lines.slice().reverse().forEach(line => {
        const lineRange = range.cloneRange();
        if (!line.contains(lineRange.startContainer)) lineRange.setStart(line, 0);
        if (!line.contains(lineRange.endContainer)) lineRange.setEnd(line, line.childNodes.length);
        wrappers.push(wrapRange(lineRange, tag, attributes));
    });
    return wrappers.at(-1) ?? null;
}

function emitInput(body) {
    body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "format" }));
}

function selectNodes(nodes) {
    if (!nodes.length) return;
    const range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    setSelection(range);
}

function unwrapMatching(root, tag) {
    Array.from(root.querySelectorAll(tag)).reverse().forEach(element => {
        element.replaceWith(...element.childNodes);
    });
}

function removeZeroWidth(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
        node.nodeValue = node.nodeValue.replace(/\u200B/g, "");
        if (!node.nodeValue) node.remove();
    });
}

function mergeTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const elements = [root];
    while (walker.nextNode()) elements.push(walker.currentNode);
    elements.forEach(element => {
        for (let index = element.childNodes.length - 1; index > 0; index--) {
            const current = element.childNodes[index];
            const previous = element.childNodes[index - 1];
            if (current.nodeType === 3 && previous.nodeType === 3) {
                previous.nodeValue += current.nodeValue;
                current.remove();
            }
        }
    });
}

function unwrapSelection(range, tag, body) {
    const wasSelected = !range.collapsed;
    const expanded = range.cloneRange();
    let ancestor = range.startContainer.nodeType === 1
        ? range.startContainer : range.startContainer.parentElement;
    while (ancestor && ancestor !== body) {
        if (ancestor.tagName?.toLowerCase() === tag) {
            const contents = document.createRange();
            contents.selectNodeContents(ancestor);
            if (range.compareBoundaryPoints(Range.START_TO_START, contents) <= 0 &&
                range.compareBoundaryPoints(Range.END_TO_END, contents) >= 0) {
                expanded.selectNode(ancestor);
                break;
            }
        }
        ancestor = ancestor.parentElement;
    }
    const containing = elementAt(range.startContainer, body, element =>
        element.tagName.toLowerCase() === tag
    );
    const sameWrapper = containing && containing === elementAt(range.endContainer, body, element =>
        element.tagName.toLowerCase() === tag
    );
    const fragment = expanded.extractContents();
    if (sameWrapper && wasSelected && containing.parentNode) {
        unwrapMatching(fragment, tag);
        removeZeroWidth(fragment);
        const selectedNodes = Array.from(fragment.childNodes);
        const suffix = containing.cloneNode(false);
        const tail = document.createRange();
        tail.setStart(expanded.startContainer, expanded.startOffset);
        tail.setEndAfter(containing);
        suffix.appendChild(tail.extractContents());
        containing.parentNode.insertBefore(suffix, containing.nextSibling);
        containing.parentNode.insertBefore(fragment, suffix);
        removeZeroWidth(containing.parentNode);
        mergeTextNodes(containing.parentNode);
        selectNodes(selectedNodes);
        debugFormat("unwrap-inside", { tag, containing, suffix });
        return;
    }
    unwrapMatching(fragment, tag);
    removeZeroWidth(fragment);
    const nodes = Array.from(fragment.childNodes);
    expanded.insertNode(fragment);
    mergeTextNodes(body);
    selectNodes(nodes);
    debugFormat("unwrap", { tag, expanded: expanded !== range, nodes });
}

function alignmentLines(body) {
    const lines = [];
    let line = [];
    Array.from(body.childNodes).forEach(node => {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "div" && node.classList.contains("align")) {
            if (line.length) lines.push(line);
            line = [node];
        } else if (node.nodeType === 1 && node.tagName.toLowerCase() === "br") {
            if (line.length) lines.push(line);
            line = [];
        } else {
            line.push(node);
        }
    });
    if (line.length || !lines.length) lines.push(line);
    return lines;
}

function normalizeAlignment(body) {
    alignmentLines(body).forEach(nodes => {
        if (nodes.length === 1 && nodes[0].nodeType === 1 && nodes[0].classList.contains("align")) {
            if (!nodes[0].hasAttribute("aType")) nodes[0].setAttribute("aType", "left");
            return;
        }
        if (!nodes.length) return;
        const wrapper = document.createElement("div");
        wrapper.className = "align";
        wrapper.setAttribute("aType", "left");
        nodes[0].parentNode.insertBefore(wrapper, nodes[0]);
        nodes.forEach(node => wrapper.appendChild(node));
    });
    Array.from(body.childNodes)
        .filter(node => node.nodeType === 1 && node.tagName.toLowerCase() === "br")
        .forEach(node => node.remove());
    return Array.from(body.children).filter(node => node.classList.contains("align"));
}

function applyAlignment(body, range, choice) {
    const lines = normalizeAlignment(body);
    lines.forEach(line => {
        try {
            if (range.collapsed ? line.contains(range.startContainer) : range.intersectsNode(line)) {
                line.setAttribute("aType", choice);
            }
        } catch { /* The selection may be invalid while the DOM is being normalized. */ }
    });
}

function removeEmpty(element) {
    if (!element || element.textContent.replace(/\u200B/g, "") || element.children.length) return false;
    const parent = element.parentNode;
    const offset = Array.prototype.indexOf.call(parent.childNodes, element);
    element.remove();
    setCaret(parent, Math.max(0, offset));
    return true;
}

function splitAtCaret(element, range) {
    const parent = element.parentNode;
    const after = element.cloneNode(false);
    const split = range.cloneRange();
    split.setStart(range.startContainer, range.startOffset);
    split.setEndAfter(element);
    after.appendChild(split.extractContents());
    parent.insertBefore(after, element.nextSibling);
    setCaret(parent, Array.prototype.indexOf.call(parent.childNodes, after));
    removeZeroWidth(element);
    removeZeroWidth(after);
}

function toggleFormat(body, definition, button) {
    if (!body) return;
    const range = selectionTextRange(window.getSelection(), body);
    if (!range) return;
    const matcher = element => element.tagName.toLowerCase() === definition.tag;
    const active = elementAt(range.startContainer, body, matcher)
        ?? (!range.collapsed ? Array.from(body.querySelectorAll(definition.tag)).find(element => {
            try { return range.intersectsNode(element); } catch { return false; }
        }) : null);

    const matching = Array.from(body.querySelectorAll(definition.tag)).filter(element => {
        try { return range.collapsed ? element === active : range.intersectsNode(element); }
        catch { return false; }
    });
    const removeFormat = Boolean(active) || matching.length > 0;
    debugFormat("toggle", {
        tag: definition.tag,
        collapsed: range.collapsed,
        buttonActive: button.classList.contains("active"),
        active,
        matching,
        rangeStart: range.startContainer,
        rangeEnd: range.endContainer,
        removeFormat
    });
    if (removeFormat) {
        if (active && range.collapsed) {
            if (!active.textContent.replace(/\u200B/g, "")) {
                removeEmpty(active);
            } else if (range.startOffset === 0 && range.startContainer === active.firstChild) {
                setCaret(active.parentNode, Array.prototype.indexOf.call(active.parentNode.childNodes, active));
            } else if (range.startOffset === range.startContainer.textContent?.length && range.startContainer === active.lastChild) {
                setCaret(active.parentNode, Array.prototype.indexOf.call(active.parentNode.childNodes, active) + 1);
            } else if (active.textContent) {
                splitAtCaret(active, range);
            } else {
                removeEmpty(active);
            }
        } else if (!range.collapsed) {
            unwrapSelection(range, definition.tag, body);
        }
        button.classList.remove("active");
        emitInput(body);
        debugFormat("toggle-off-complete", { tag: definition.tag, body });
        return;
    }

    wrapRangeInsideAlignLines(range, definition.tag, {}, body);
    button.classList.add("active");
    emitInput(body);
    debugFormat("toggle-on-complete", { tag: definition.tag, body });
}

function applyChoice(body, select, button, choice) {
    let range = selectionTextRange(window.getSelection(), body);
    if (!range) return;
    const definitions = {
        fontSize: { tag: "p", attributes: { class: "heading", hSize: choice.replace(/^h/i, "") } },
        fontFamily: { tag: "span", attributes: { class: "font", fSrc: choice } },
        align: { tag: "div", attributes: { class: "align", aType: choice } },
        type: choice === "superscript" ? { tag: "sup" } : choice === "subscript" ? { tag: "sub" } : null
    };
    const bodyElement = getBody(range, body);
    const currentType = elementAt(range.startContainer, bodyElement, element => ["sup", "sub"].includes(element.tagName.toLowerCase()));
    if (select.dataset.formatter === "type") {
        if (choice === "normal" && !currentType) return;
        if (currentType && choice === "normal") {
            currentType.replaceWith(...currentType.childNodes);
            removeZeroWidth(bodyElement);
            emitInput(bodyElement);
            return;
        }
        if (currentType && currentType.tagName.toLowerCase() !== definitions.type?.tag) {
            if (range.collapsed) {
                splitAtCaret(currentType, range);
                range = selectionTextRange(window.getSelection(), body);
            }
            else currentType.replaceWith(...currentType.childNodes);
        }
    }
    const definition = definitions[select.dataset.formatter];
    if (!definition) return;
    if (select.dataset.formatter === "align") {
        applyAlignment(bodyElement, range, choice);
    } else {
        wrapRangeInsideAlignLines(range, definition.tag, definition.attributes, bodyElement);
    }
    button.classList.add("active");
    emitInput(bodyElement);
}

export function setupFormatter({ body, buttons, selects, colorButtons, linkButton }) {
    let savedRange = null;
    let syncingSelection = false;
    function updateToggleState() {
        const range = selectionTextRange(window.getSelection(), body);
        Object.entries(buttons).forEach(([name, button]) => {
            const definition = TAGS[name];
            const active = range && elementAt(range.startContainer, body, element =>
                element.tagName.toLowerCase() === definition.tag
            );
            button.classList.toggle("active", Boolean(active));
        });
    }
    const rememberSelection = () => {
        if (syncingSelection) return;
        const range = selectionTextRange(window.getSelection(), body);
        if (range) {
            savedRange = range.cloneRange();
            debugFormat("selection", {
                collapsed: range.collapsed,
                start: range.startContainer,
                startOffset: range.startOffset,
                end: range.endContainer,
                endOffset: range.endOffset
            });
            updateToggleState();
        }
    };
    const restoreSelection = () => {
        if (!savedRange) return false;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return true;
    };
    const liveOrSavedRange = () => {
        const live = selectionTextRange(window.getSelection(), body);
        if (live) return live;
        restoreSelection();
        return selectionTextRange(window.getSelection(), body);
    };

    body.addEventListener("keyup", rememberSelection);
    body.addEventListener("mouseup", rememberSelection);
    body.addEventListener("input", rememberSelection);
    document.addEventListener("selectionchange", rememberSelection);
    Object.entries(buttons).forEach(([name, button]) => {
        button.addEventListener("pointerdown", event => event.preventDefault());
        button.addEventListener("click", () => {
            syncingSelection = true;
            const range = liveOrSavedRange();
            debugFormat("button-click", { name, range, savedRange, live: Boolean(range) });
            toggleFormat(getBody(range, body), TAGS[name], button);
            queueMicrotask(() => { syncingSelection = false; });
        });
    });
    Object.entries(selects).forEach(([name, select]) => {
        select.dataset.formatter = name;
        select.addEventListener("pointerdown", rememberSelection);
        select.addEventListener("change", () => {
            restoreSelection();
            const button = select.dataset.button ? document.querySelector(select.dataset.button) : select;
            applyChoice(body, select, button, select.value);
        });
    });
    colorButtons.text.addEventListener("click", () => {
        restoreSelection();
        const color = prompt("Text color:", "#000000");
        const range = selectionTextRange(window.getSelection(), body);
        const target = getBody(range, body);
        if (color) { wrapRangeInsideAlignLines(range, "span", {
            class: "color", col: color, style: `color: ${color}`
        }, target); emitInput(target); }
    });
    colorButtons.background.addEventListener("click", () => {
        restoreSelection();
        const color = prompt("Background color:", "#FFFF00");
        const range = selectionTextRange(window.getSelection(), body);
        const target = getBody(range, body);
        if (color) { wrapRangeInsideAlignLines(range, "span", {
            class: "color", col: color, type: "background", style: `background-color: ${color}`
        }, target); emitInput(target); }
    });
    linkButton.addEventListener("click", () => {
        restoreSelection();
        // Link dialog can call wrapRange through this future hook.
        linkButton.dispatchEvent(new CustomEvent("formatter-link", { detail: { range: selectionTextRange(window.getSelection(), body) } }));
    });
}