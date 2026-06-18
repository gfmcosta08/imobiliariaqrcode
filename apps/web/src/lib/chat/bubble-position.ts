export const FALE_CONOSCO_BUBBLE_POS_KEY = "fale_conosco_bubble_position";

export const CHAT_BUBBLE_SIZE_PX = 56;
export const CHAT_BUBBLE_DRAG_THRESHOLD_PX = 8;
export const CHAT_BUBBLE_MARGIN_PX = 8;

export type BubblePosition = {
  x: number;
  y: number;
};

export function getDefaultBubblePosition(viewportWidth: number, viewportHeight: number): BubblePosition {
  return {
    x: Math.max(
      CHAT_BUBBLE_MARGIN_PX,
      viewportWidth - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX,
    ),
    y: Math.max(
      CHAT_BUBBLE_MARGIN_PX,
      viewportHeight - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX,
    ),
  };
}

export function clampBubblePosition(
  position: BubblePosition,
  viewportWidth: number,
  viewportHeight: number,
): BubblePosition {
  const maxX = Math.max(CHAT_BUBBLE_MARGIN_PX, viewportWidth - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX);
  const maxY = Math.max(CHAT_BUBBLE_MARGIN_PX, viewportHeight - CHAT_BUBBLE_SIZE_PX - CHAT_BUBBLE_MARGIN_PX);
  return {
    x: Math.min(Math.max(CHAT_BUBBLE_MARGIN_PX, position.x), maxX),
    y: Math.min(Math.max(CHAT_BUBBLE_MARGIN_PX, position.y), maxY),
  };
}

export function loadBubblePosition(
  viewportWidth: number,
  viewportHeight: number,
): BubblePosition {
  if (typeof window === "undefined") {
    return getDefaultBubblePosition(viewportWidth, viewportHeight);
  }
  try {
    const raw = localStorage.getItem(FALE_CONOSCO_BUBBLE_POS_KEY);
    if (!raw) return getDefaultBubblePosition(viewportWidth, viewportHeight);
    const parsed = JSON.parse(raw) as Partial<BubblePosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return getDefaultBubblePosition(viewportWidth, viewportHeight);
    }
    return clampBubblePosition({ x: parsed.x, y: parsed.y }, viewportWidth, viewportHeight);
  } catch {
    return getDefaultBubblePosition(viewportWidth, viewportHeight);
  }
}

export function saveBubblePosition(position: BubblePosition): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FALE_CONOSCO_BUBBLE_POS_KEY, JSON.stringify(position));
}
