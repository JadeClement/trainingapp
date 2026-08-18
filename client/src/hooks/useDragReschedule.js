import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_MS = 300;
const MOVE_CANCEL_PX = 8;

// Press-and-hold drag-to-reschedule for calendar workouts: hold a row or
// chip briefly, it lifts (tracked via `drag` state, rendered as a floating
// ghost by the caller), drag it over a day cell tagged
// data-day-key="YYYY-MM-DD", and release to reschedule it there. Built on
// Pointer Events so the same code drives mouse, touch, and pen, and a short
// hold threshold keeps a quick tap free to open the workout as normal.
export function useDragReschedule(onDropOnDay) {
  const [drag, setDrag] = useState(null); // { workout, x, y, overKey } | null
  const pressRef = useRef(null);
  const suppressClickRef = useRef(false);

  const cleanup = useCallback(() => {
    const p = pressRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    window.removeEventListener('pointermove', p.onMove);
    window.removeEventListener('pointerup', p.onUp);
    window.removeEventListener('pointercancel', p.onCancel);
    document.body.style.touchAction = '';
    document.body.style.userSelect = '';
    pressRef.current = null;
  }, []);

  const bindDraggable = useCallback(
    (workout, onClick) => ({
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cleanup();

        const startX = e.clientX;
        const startY = e.clientY;
        const press = { dragging: false };

        press.onMove = (ev) => {
          if (!press.dragging) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cleanup();
            return;
          }
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const overKey = el?.closest('[data-day-key]')?.dataset.dayKey ?? null;
          setDrag({ workout, x: ev.clientX, y: ev.clientY, overKey });
        };

        press.onUp = (ev) => {
          if (press.dragging) {
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const overKey = el?.closest('[data-day-key]')?.dataset.dayKey ?? null;
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

        press.timer = setTimeout(() => {
          press.dragging = true;
          document.body.style.touchAction = 'none';
          document.body.style.userSelect = 'none';
          setDrag({ workout, x: startX, y: startY, overKey: null });
        }, LONG_PRESS_MS);

        pressRef.current = press;
        window.addEventListener('pointermove', press.onMove);
        window.addEventListener('pointerup', press.onUp);
        window.addEventListener('pointercancel', press.onCancel);
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
