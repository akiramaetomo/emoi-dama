export function renderCreateBallIcon(): string {
  return `
    <span class="dock-create-action-icon" aria-hidden="true">
      <span class="dock-create-ball-icon"><span>＋</span></span>
      <small class="dock-create-label">new</small>
    </span>
  `;
}

export function renderPlayScreenIcon(): string {
  return `<span class="play-triple-ball-icon" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

export function renderCalendarScreenIcon(): string {
  return `
    <span class="calendar-screen-icon" aria-hidden="true">
      <svg viewBox="0 0 32 28" focusable="false">
        <rect class="calendar-icon-frame" x="2" y="2.5" width="28" height="24" rx="0.8"></rect>
        <line class="calendar-icon-bar" x1="12.75" y1="8" x2="19.25" y2="8"></line>
        <circle class="calendar-icon-dot" cx="8.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="21.5" r="1.45"></circle>
      </svg>
    </span>
  `;
}
