export function getCoords(element, e) {
    const { left, top } = element.getBoundingClientRect();
    const { clientWidth, clientHeight } = element;
    const [x, y] = [e.pageX - left, e.pageY - top];

    if (x >= clientWidth || y >= clientHeight) {
        // Ignore clicks on scrollbars
        e.stopPropagation();
        return null;
    }

    return [x, y];
}

export function isMac() {
    return navigator.platform.toLowerCase().indexOf('mac') >= 0
}
