import { useCallback, useRef, useState } from 'react';

const LONG_PRESS_MS = 300;
const MOVE_PX = 8;
const MOVE_LISTENER = { capture: true, passive: false };
const END_LISTENER = { capture: true };

// Hit-test day cells by geometry instead of elementFromPoint. Pointer capture
// (and the floating ghost) make the original chip the hit target, so the
// source day would keep the drop highlight and release would never reschedule.
function dayKeyFromPoint(x, y) {
  const cells = document.querySelectorAll('[data-day-key]');
  for (const cell of cells) {
    const r = cell.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
      return cell.dataset.dayKey ?? null;
    }
  }
  return null;
}

function swallowNextClick() {
  const swallow = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
}

// Drag-to-reschedule for calendar workouts. Mouse/pen: drag starts after a
// few pixels of movement (click still opens the workout). Touch: a short
// hold lifts the workout so the calendar can still scroll. Drop targets are
// day cells tagged data-day-key="YYYY-MM-DD".
export function useDragReschedule(onDropOnDay) {
  const [drag, setDrag] = useState(null); // { workout, x, y, width, overKey } | null
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
        const origin = e.currentTarget.getBoundingClientRect();
        const isTouch = e.pointerType === 'touch';
        const press = {
          dragging: false,
          pointerId: e.pointerId,
          target: e.currentTarget,
          offsetX: startX - origin.left,
          offsetY: startY - origin.top,
          width: origin.width,
        };

        const snapshot = (x, y) => {
          const overKey = dayKeyFromPoint(x, y);
          return {
            workout,
            x: x - press.offsetX,
            y: y - press.offsetY,
            width: press.width,
            overKey: overKey && overKey !== workout.scheduledDate ? overKey : null,
          };
        };

        const beginDrag = (x, y) => {
          if (press.dragging) return;
          press.dragging = true;
          document.body.style.touchAction = 'none';
          document.body.style.userSelect = 'none';
          document.body.style.webkitUserSelect = 'none';
          try {
            // Capture only after a drag has started. Capturing on pointerdown
            // of a link swallows the browser's default navigation, so Back
            // never gets a real history entry.
            press.target.setPointerCapture(press.pointerId);
          } catch {
            // Capture can fail if the node isn't in the tree; window listeners still work.
          }
          setDrag(snapshot(x, y));
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
          setDrag(snapshot(ev.clientX, ev.clientY));
        };

        press.onUp = (ev) => {
          if (press.dragging) {
            const overKey = dayKeyFromPoint(ev.clientX, ev.clientY);
            if (overKey && overKey !== workout.scheduledDate) onDropOnDay(workout, overKey);
            suppressClickRef.current = true;
            swallowNextClick();
            setDrag(null);
          }
          cleanup();
        };

        press.onCancel = () => {
          setDrag(null);
          cleanup();
        };

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
