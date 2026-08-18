import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_MS = 300;
const MOVE_PX = 8;
const MOVE_LISTENER = { capture: true, passive: false };
const END_LISTENER = { capture: true };

function dayKeyFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest('[data-day-key]')?.dataset.dayKey ?? null;
}

// Drag-to-reschedule for calendar workouts. Mouse/pen: drag starts after a
// few pixels of movement (click still opens the workout). Touch: a short
// hold lifts the workout so the calendar can still scroll. Drop targets are
// day cells tagged data-day-key="YYYY-MM-DD".
export function useDragReschedule(onDropOnDay) {
  const [drag, setDrag] = useState(null); // { workout, x, y, overKey } | null
  const pressRef = useRef(null);
  const suppressClickRef = useRef(false);

  const cleanup = useCallback(() => {
    const p = pressRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    window.removeEventListener('pointermove', p.onMove, MOVE_LISTENER);
    window.removeEventListener('pointerup', p.onUp, END_LISTENER);
    window.removeEventListener('pointercancel', p.onCancel, END_LISTENER);
    if (p.pointerId != null && p.target?.hasPointerCapture?.(p.pointerId)) {
      p.target.releasePointerCapture(p.pointerId);
    }
    document.body.style.touchAction = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    pressRef.current = null;
  }, []);

  const bindDraggable = useCallback(
    (workout, onClick) => ({
      draggable: false,
      onDragStart: (e) => e.preventDefault(),
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cleanup();

        const startX = e.clientX;
        const startY = e.clientY;
        const isTouch = e.pointerType === 'touch';
        const press = {
          dragging: false,
          pointerId: e.pointerId,
          target: e.currentTarget,
        };

        const beginDrag = (x, y) => {
          if (press.dragging) return;
          press.dragging = true;
          document.body.style.touchAction = 'none';
          document.body.style.userSelect = 'none';
          document.body.style.webkitUserSelect = 'none';
          setDrag({ workout, x, y, overKey: dayKeyFromPoint(x, y) });
        };

        press.onMove = (ev) => {
          const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
          if (!press.dragging) {
            if (isTouch) {
              if (dist > MOVE_PX) cleanup();
              return;
            }
            if (dist <= MOVE_PX) return;
            beginDrag(ev.clientX, ev.clientY);
          }
          ev.preventDefault();
          setDrag({
            workout,
            x: ev.clientX,
            y: ev.clientY,
            overKey: dayKeyFromPoint(ev.clientX, ev.clientY),
          });
        };

        press.onUp = (ev) => {
          if (press.dragging) {
            const overKey = dayKeyFromPoint(ev.clientX, ev.clientY);
            if (overKey && overKey !== workout.scheduledDate) onDropOnDay(workout, overKey);
            suppressClickRef.current = true;
            setDrag(null);
          }
          cleanup();
        };

        press.onCancel = () => {
          setDrag(null);
          cleanup();
        };

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture can fail if the node isn't in the tree; window listeners still work.
        }

        if (!isTouch) {
          document.body.style.userSelect = 'none';
          document.body.style.webkitUserSelect = 'none';
        } else {
          press.timer = setTimeout(() => beginDrag(startX, startY), LONG_PRESS_MS);
        }

        pressRef.current = press;
        window.addEventListener('pointermove', press.onMove, MOVE_LISTENER);
        window.addEventListener('pointerup', press.onUp, END_LISTENER);
        window.addEventListener('pointercancel', press.onCancel, END_LISTENER);
      },
      onClick: (e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      },
    }),
    [cleanup, onDropOnDay]
  );

  return { drag, bindDraggable };
}
