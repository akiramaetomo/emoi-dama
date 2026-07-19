import {
  calculateDomBallRadius,
  calculateDenseBallRadius,
  createPlayRenderPlan,
  DENSE_APPEARANCE_MAX_DIAMETER_PX,
  denseDeviceLimit,
  DOM_MIN_BALL_RADIUS_PX,
  limitVisualPopulation,
  needsDenseRendering,
  sortNewestFirst,
} from "./play-population.js";

const sorted = sortNewestFirst([
  { id: "b", createdAt: "2026-07-18T10:00:00.000Z" },
  { id: "c", createdAt: "2026-07-18T11:00:00.000Z" },
  { id: "a", createdAt: "2026-07-18T10:00:00.000Z" },
]);
assert(sorted.map((item) => item.id).join(",") === "c,b,a", "newest records and then newest ids should appear first");

const population = limitVisualPopulation(Array.from({ length: 125 }, (_, index) => index), 120);
assert(population.displayedCount === 120, "DOM population should stop at its safety limit");
assert(population.totalCount === 125 && population.truncated, "population plan should preserve the true total");
assert(population.displayed[119] === 119, "population limiting should preserve newest-first source order");

const fitted = calculateDomBallRadius(1000, 800, 100, 80);
const expected = Math.sqrt((1000 * 800 * 0.45) / (Math.PI * 100));
assert(Math.abs(fitted - expected) < 0.001, "DOM radius should target 45% field fill");
assert(calculateDomBallRadius(320, 480, 120, 80) === DOM_MIN_BALL_RADIUS_PX, "DOM radius should retain its temporary readability floor");
assert(calculateDomBallRadius(1000, 800, 1, 60) === 60, "auto fit should not enlarge the requested radius");
assert(Math.abs(calculateDenseBallRadius(1000, 800, 1000) - Math.sqrt(240000 / (Math.PI * 1000))) < 0.001, "dense radius should target 30% field fill");
assert(calculateDenseBallRadius(10, 10, 1000) === 2, "dense radius should retain a 2px floor");
assert(needsDenseRendering(1000, 800, 121, 60), "more than 120 bodies should select dense rendering");
assert(needsDenseRendering(320, 480, 100, 60), "an area that cannot retain a 24px radius should select dense rendering");
assert(!needsDenseRendering(1000, 800, 20, 60), "a breathable normal population should retain faithful rendering");
assert(denseDeviceLimit(true) === 500 && denseDeviceLimit(false) === 1000, "dense limits should distinguish narrow phones from PC and iPad");

const phone160 = createPlayRenderPlan(360, 648, 160, 42);
assert(phone160.renderer === "pixi", "160 phone balls should leave the DOM renderer");
assert(phone160.appearanceProfile === "faithful", "160 phone balls should retain faithful Pixi appearance");
assert(phone160.radiusMode === "dense", "Pixi populations should use packed radius calculation");

const justFaithful = createPlayRenderPlan(360, 360, 343, 42);
assert(justFaithful.radius * 2 > DENSE_APPEARANCE_MAX_DIAMETER_PX, "the boundary fixture should remain above 12px");
assert(justFaithful.appearanceProfile === "faithful", "diameters above 12px should stay faithful");
const justDense = createPlayRenderPlan(360, 360, 344, 42);
assert(justDense.radius * 2 <= DENSE_APPEARANCE_MAX_DIAMETER_PX, "the boundary fixture should reach 12px");
assert(justDense.appearanceProfile === "dense-gloss", "diameters at or below 12px should use dense gloss");

const standardSize = createPlayRenderPlan(1000, 800, 20, 60);
assert(standardSize.renderer === "pixi", "normal URLs should use faithful Pixi even at standard size");
assert(standardSize.appearanceProfile === "faithful" && standardSize.radiusMode === "dom", "standard Pixi should retain normal sizing and appearance");

const forcedDomComparison = createPlayRenderPlan(1000, 800, 20, 60, "dom");
assert(forcedDomComparison.renderer === "dom", "the development comparison should explicitly select DOM");
assert(forcedDomComparison.appearanceProfile === "faithful" && forcedDomComparison.radiusMode === "dom", "DOM comparison should retain normal sizing and appearance");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
