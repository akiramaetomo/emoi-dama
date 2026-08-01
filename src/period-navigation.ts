export type PeriodNavigationDirection = "previous" | "next";

export function renderPeriodChevronIcon(direction: PeriodNavigationDirection): string {
  return `
    <svg class="period-chevron period-chevron-${direction}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15.5 4.5 8 12l7.5 7.5"></path>
    </svg>
  `;
}
