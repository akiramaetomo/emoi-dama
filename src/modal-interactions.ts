export interface ModalPanState {
  deltaX: number;
  deltaY: number;
  startedInsideScrollRegion: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function shouldPreventModalPan(state: ModalPanState): boolean {
  if (!state.startedInsideScrollRegion) {
    return true;
  }

  if (Math.abs(state.deltaX) > Math.abs(state.deltaY)) {
    return true;
  }

  const maxScrollTop = Math.max(0, state.scrollHeight - state.clientHeight);
  if (maxScrollTop === 0) {
    return state.deltaY !== 0;
  }

  if (state.deltaY > 0 && state.scrollTop <= 0) {
    return true;
  }

  if (state.deltaY < 0 && state.scrollTop >= maxScrollTop - 1) {
    return true;
  }

  return false;
}

export function resolveFocusScrollDelta(input: {
  regionTop: number;
  regionBottom: number;
  fieldTop: number;
  fieldBottom: number;
  padding?: number;
}): number {
  const padding = input.padding ?? 16;
  const visibleTop = input.regionTop + padding;
  const visibleBottom = input.regionBottom - padding;

  if (input.fieldTop < visibleTop) {
    return input.fieldTop - visibleTop;
  }

  if (input.fieldBottom > visibleBottom) {
    return input.fieldBottom - visibleBottom;
  }

  return 0;
}
