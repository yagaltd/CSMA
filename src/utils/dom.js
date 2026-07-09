const SVG_NS = 'http://www.w3.org/2000/svg';

export function clearChildren(node) {
    while (node?.firstChild) {
        node.removeChild(node.firstChild);
    }
}

export function appendTextOrNode(target, content) {
    if (content instanceof Node) {
        target.appendChild(content);
        return;
    }

    if (content !== null && content !== undefined) {
        target.textContent = String(content);
    }
}

export function createSvgElement(tag, attrs = {}, children = []) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([name, value]) => {
        if (value !== null && value !== undefined) {
            element.setAttribute(name, String(value));
        }
    });
    children.forEach((child) => element.appendChild(child));
    return element;
}

export function createIcon(viewBox, children, attrs = {}) {
    return createSvgElement('svg', {
        viewBox,
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
        ...attrs
    }, children);
}
