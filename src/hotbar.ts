import { canvasViewport, CONFIG } from "./config";
import { getBlockType } from "./blockTypes";
import type { Inventory } from "./inventory";

/**
 * HotbarRenderer draws the hotbar UI in screen space, bottom-center.
 *
 *   - one slot per hotbar slot, with a translucent dark background and border;
 *   - the selected slot gets a bright gold border (matches the 1-9 selection);
 *   - each non-empty slot shows a swatch of its block color plus the stack
 *     count in the corner, and every slot shows its 1-9 number label.
 *
 * It lives in the "ui" render layer: pure drawing, reads the Inventory state
 * and never modifies it.
 */
export class HotbarRenderer {
  render(ctx: CanvasRenderingContext2D, inventory: Inventory): void {
    const { hotbarSlots, slotSize, slotGap, bottomMargin } = CONFIG.inventory;
    const barWidth = hotbarSlots * slotSize + (hotbarSlots - 1) * slotGap;
    const startX = (canvasViewport.width - barWidth) / 2;
    const y = canvasViewport.height - bottomMargin - slotSize;

    for (let i = 0; i < hotbarSlots; i++) {
      const x = startX + i * (slotSize + slotGap);
      const selected = i === inventory.selectedIndex;

      // Slot background so empty and filled slots read as one bar.
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(x, y, slotSize, slotSize);

      const stack = inventory.slots[i];
      if (stack) {
        // Block swatch: the block's flat color, inset from the slot edge.
        const inset = 6;
        ctx.fillStyle = getBlockType(stack.id).color;
        ctx.fillRect(x + inset, y + inset, slotSize - inset * 2, slotSize - inset * 2);

        // Stack count in the bottom-right corner.
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(stack.count), x + slotSize - 4, y + slotSize - 4);
      }

      // Slot number label (1-9) top-left, dim so it never fights the block.
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(i + 1), x + 3, y + 3);

      // Border: bright gold on the selected slot, dim white elsewhere.
      ctx.strokeStyle = selected
        ? "rgba(255, 220, 120, 0.95)"
        : "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = selected ? 3 : 2;
      const inset = selected ? 1.5 : 0;
      ctx.strokeRect(x + inset, y + inset, slotSize - inset * 2, slotSize - inset * 2);
    }
  }
}
