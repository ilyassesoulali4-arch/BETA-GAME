/**
 * ErrorOverlay surfaces any runtime error on screen.
 *
 * A silent black canvas hides the actual cause of a failure: the game stops
 * drawing but nothing tells the player why. This installs window-level error
 * and unhandled-rejection listeners that paint the message into a small red
 * overlay, so a crash becomes visible (and reportable) instead of just a black
 * screen. It is purely diagnostic: it never changes game behaviour.
 */
export function installErrorOverlay(): void {
  const show = (message: string): void => {
    let el = document.getElementById("error-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "error-overlay";
      el.style.position = "fixed";
      el.style.left = "8px";
      el.style.bottom = "40px";
      el.style.right = "8px";
      el.style.zIndex = "10000";
      el.style.background = "rgba(150, 0, 0, 0.92)";
      el.style.color = "#fff";
      el.style.fontFamily = "monospace";
      el.style.fontSize = "12px";
      el.style.padding = "8px 10px";
      el.style.whiteSpace = "pre-wrap";
      el.style.borderRadius = "4px";
      document.body.appendChild(el);
    }
    el.textContent = message;
  };

  window.addEventListener("error", (event) => {
    const at = event.filename ? `\n${event.filename}:${event.lineno}:${event.colno}` : "";
    show(`Runtime error: ${event.message}${at}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event.reason instanceof Error ? event.reason.message : String(event.reason);
    show(`Unhandled rejection: ${reason}`);
  });
}
