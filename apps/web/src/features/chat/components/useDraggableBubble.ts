"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHAT_BUBBLE_DRAG_THRESHOLD_PX,
  CHAT_BUBBLE_SIZE_PX,
  clampBubblePosition,
  loadBubblePosition,
  saveBubblePosition,
  type BubblePosition,
} from "../lib/bubble-position";

type UseDraggableBubbleOptions = {
  onTap: () => void;
};

export function useDraggableBubble({ onTap }: UseDraggableBubbleOptions) {
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    const sync = () => {
      setPosition(loadBubblePosition(window.innerWidth, window.innerHeight));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (position == null) return;
      dragRef.current = {
        active: true,
        moved: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < CHAT_BUBBLE_DRAG_THRESHOLD_PX) return;

    drag.moved = true;
    const next = clampBubblePosition(
      { x: drag.originX + dx, y: drag.originY + dy },
      window.innerWidth,
      window.innerHeight,
    );
    setPosition(next);
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      drag.active = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (drag.moved && position) {
        saveBubblePosition(position);
      } else {
        onTap();
      }
    },
    [onTap, position],
  );

  const onPointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const style =
    position == null
      ? undefined
      : {
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${CHAT_BUBBLE_SIZE_PX}px`,
          height: `${CHAT_BUBBLE_SIZE_PX}px`,
          touchAction: "none" as const,
        };

  return {
    position,
    style,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
