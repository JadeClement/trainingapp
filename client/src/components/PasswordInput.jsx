import { useState } from 'react';
import { EyeIcon } from './icons.jsx';

export function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  function reveal(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  function onKeyDown(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setVisible(true);
    }
  }

  function onKeyUp(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setVisible(false);
    }
  }

  return (
    <div className="password-field">
      <input type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-reveal"
        aria-label="Show password"
        aria-pressed={visible}
        onPointerDown={reveal}
        onPointerUp={hide}
        onPointerCancel={hide}
        onBlur={hide}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <EyeIcon />
      </button>
    </div>
  );
}
