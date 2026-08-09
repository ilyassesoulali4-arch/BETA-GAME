/**
 * Pointer tracks the mouse relative to the game canvas.
 *
 * It is raw input state only: screen position plus button states. It knows
 * nothing about the world, the camera or blocks. Converting screen coordinates
 * into world coordinates is the job of the interaction system.
 */
export class Pointer {
  x = 0;
  y = 0;
  leftDown = false;
  rightDown = false;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mousemove", this.onMove);
    canvas.addEventListener("mousedown", this.onDown);
    canvas.addEventListener("mouseup", this.onUp);
    // Keep the browser context menu from popping up on right clicks.
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private readonly onMove = (event: MouseEvent): void => {
    const canvas = event.currentTarget as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    // The canvas fills the window; map screen pixels back to the canvas's
    // internal coordinate space (which matches the on-screen size 1:1).
    this.x =
      ((event.clientX - bounds.left) * canvas.width) / bounds.width;
    this.y =
      ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  };

  private readonly onDown = (event: MouseEvent): void => {
    this.onMove(event);
    if (event.button === 0) {
      this.leftDown = true;
    } else if (event.button === 2) {
      this.rightDown = true;
    }
  };

  private readonly onUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.leftDown = false;
    } else if (event.button === 2) {
      this.rightDown = false;
    }
  };
}
