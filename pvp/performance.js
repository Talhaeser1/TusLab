/** Phase 19: lightweight DOM updates without touching authoritative game state. */
export function setTextIfChanged(node, value) {
  if (!node) return false;
  const next=String(value);
  if (node.textContent === next) return false;
  node.textContent=next;
  return true;
}
export function setAttributeIfChanged(node, name, value) {
  if (!node) return false;
  const next=String(value);
  if (node.getAttribute(name)===next) return false;
  node.setAttribute(name,next);
  return true;
}
export function setWidthIfChanged(node, width) {
  if (!node) return false;
  const next=String(width);
  if (node.style.width===next) return false;
  node.style.width=next;
  return true;
}
export function setClassIfChanged(node,name,enabled){
  if (!node) return false;
  const wanted=Boolean(enabled);
  if (node.classList.contains(name)===wanted) return false;
  node.classList.toggle(name,wanted);
  return true;
}
export function shouldPaint(hidden,forced=false){return Boolean(forced||!hidden);}
