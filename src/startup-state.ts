import type { HappyBall } from "./models";
import type { StartupScreen } from "./settings";

export interface StartupScreenState {
  displayAnchorDate: string;
  calendarMonth: string;
  selectedBallId: string | null;
  startupScreen: StartupScreen;
}

export function createStartupScreenState(
  balls: HappyBall[],
  today: string,
  startupScreen: StartupScreen = "calendarMonth",
): StartupScreenState {
  const selectedBall = balls.find((ball) => ball.date === today && ball.lifecycleStatus !== "offered") ?? null;
  return {
    displayAnchorDate: today,
    calendarMonth: today.slice(0, 7),
    selectedBallId: selectedBall?.id ?? null,
    startupScreen,
  };
}
