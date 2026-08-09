// Primary controls are WASD. Arrow keys remain as an alternative.
const KEY_LEFT = "a";
const KEY_RIGHT = "d";
const KEY_JUMP = "w";
const KEY_JUMP_SPACE = " ";
const KEY_LEFT_ALT = "arrowleft";
const KEY_RIGHT_ALT = "arrowright";
const KEY_JUMP_ALT = "arrowup";

export class Input {
  private readonly pressed = new Set<string>();
  private readonly hotbarPresses: number[] = [];

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  isDown(key: string): boolean {
    return this.pressed.has(key);
  }

  /**
   * The most recent hotbar slot selected by the 1-9 keys (0-based), or null
   * when no slot key was pressed since the last call. Consumed on read so each
   * press edge selects exactly once.
   */
  consumeHotbarSlot(): number | null {
    return this.hotbarPresses.length > 0 ? this.hotbarPresses.shift()! : null;
  }

  isLeftDown(): boolean {
    return this.isDown(KEY_LEFT) || this.isDown(KEY_LEFT_ALT);
  }

  isRightDown(): boolean {
    return this.isDown(KEY_RIGHT) || this.isDown(KEY_RIGHT_ALT);
  }

  isJumpDown(): boolean {
    return (
      this.isDown(KEY_JUMP) ||
      this.isDown(KEY_JUMP_SPACE) ||
      this.isDown(KEY_JUMP_ALT)
    );
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Normalize so WASD works regardless of Caps Lock / Shift state.
    this.pressed.add(event.key.toLowerCase());

    // Queue a hotbar selection for the 1-9 number keys (single digits only, so
    // e.g. Shift+1 producing "!" is ignored).
    const key = event.key.toLowerCase();
    if (key.length === 1 && key >= "1" && key <= "9") {
      this.hotbarPresses.push(Number(key) - 1);
    }

    // Prevent the page from scrolling when game keys are used.
    if (
      key === KEY_LEFT ||
      key === KEY_RIGHT ||
      key === KEY_LEFT_ALT ||
      key === KEY_RIGHT_ALT ||
      key === KEY_JUMP_SPACE
    ) {
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.key.toLowerCase());
  };
}
