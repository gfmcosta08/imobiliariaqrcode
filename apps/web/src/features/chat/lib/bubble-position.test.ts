import { describe, expect, it } from "vitest";

import {
  CHAT_BUBBLE_MARGIN_PX,
  CHAT_BUBBLE_SIZE_PX,
  clampBubblePosition,
  getDefaultBubblePosition,
} from "./bubble-position";

describe("bubble position", () => {
  it("posiciona padrao no canto inferior direito", () => {
    const pos = getDefaultBubblePosition(400, 800);
    expect(pos.x).toBe(400 - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX);
    expect(pos.y).toBe(800 - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX);
  });

  it("limita arraste dentro da viewport", () => {
    expect(clampBubblePosition({ x: -50, y: -50 }, 360, 640)).toEqual({
      x: CHAT_BUBBLE_MARGIN_PX,
      y: CHAT_BUBBLE_MARGIN_PX,
    });
    expect(clampBubblePosition({ x: 999, y: 999 }, 360, 640)).toEqual({
      x: 360 - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX,
      y: 640 - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX,
    });
  });
});
