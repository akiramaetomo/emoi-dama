import { resolveFocusScrollDelta, shouldPreventModalPan } from "./modal-interactions.js";

assert(
  shouldPreventModalPan({
    deltaX: 24,
    deltaY: 4,
    startedInsideScrollRegion: true,
    scrollTop: 80,
    scrollHeight: 800,
    clientHeight: 400,
  }),
  "horizontal modal pans should be prevented",
);

assert(
  shouldPreventModalPan({
    deltaX: 0,
    deltaY: 18,
    startedInsideScrollRegion: false,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  }),
  "backdrop pans should be prevented",
);

assert(
  shouldPreventModalPan({
    deltaX: 2,
    deltaY: 18,
    startedInsideScrollRegion: true,
    scrollTop: 0,
    scrollHeight: 800,
    clientHeight: 400,
  }),
  "pulling past the top should be prevented",
);

assert(
  shouldPreventModalPan({
    deltaX: 2,
    deltaY: -18,
    startedInsideScrollRegion: true,
    scrollTop: 400,
    scrollHeight: 800,
    clientHeight: 400,
  }),
  "pushing past the bottom should be prevented",
);

assert(
  !shouldPreventModalPan({
    deltaX: 2,
    deltaY: -18,
    startedInsideScrollRegion: true,
    scrollTop: 160,
    scrollHeight: 800,
    clientHeight: 400,
  }),
  "vertical movement inside a scrollable modal should remain available",
);

assert(
  resolveFocusScrollDelta({ regionTop: 0, regionBottom: 500, fieldTop: 180, fieldBottom: 230 }) === 0,
  "fully visible fields should not move the modal",
);

assert(
  resolveFocusScrollDelta({ regionTop: 0, regionBottom: 500, fieldTop: 470, fieldBottom: 530 }) === 46,
  "fields below the visible region should scroll only by the required amount",
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
