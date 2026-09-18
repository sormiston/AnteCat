import { Numeral } from "@/components/shared/Numeral";
import {
  formatTimeRemaining,
  timeRemaining,
  timeRemainingParts,
  windowElapsedFraction,
} from "@/domain/deadlines";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

/**
 * The screen's largest figure, because urgency is what this product adds to a
 * group chat (README's "The problem"). Everything else here can wait for a
 * refresh; this cannot.
 */

const TICK_MS = 1000;
const RULE_TICK_MS = 30_000;
const LAST_DAY_MS = 24 * 60 * 60 * 1000;

function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(interval);
  }, [everyMs]);
  return now;
}

/** The final day, and nothing else in the app, is brass. */
function isUrgent(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs < LAST_DAY_MS;
}

export function DeadlineCountdown({ deadlineAt }: { deadlineAt: string }) {
  const remaining = timeRemaining(deadlineAt, useNow(TICK_MS));

  const { days, clock } = timeRemainingParts(remaining);
  const tone = isUrgent(remaining.totalMs) ? "text-brass" : "text-white";
  // A clock with a days part beside it is two characters longer, which at the
  // hero size runs past the badge on a phone -- so that shape is set smaller.
  const size = days ? "text-[32px]" : "text-[40px]";

  return (
    <View
      className="gap-1"
      accessibilityLabel={formatTimeRemaining(remaining)}
      testID="DeadlineCountdown"
    >
      <View className="flex-row items-baseline gap-[6px]">
        {days ? (
          <Numeral className={`text-[21px] leading-[46px] ${tone}`}>
            {days}
          </Numeral>
        ) : null}
        <Numeral className={`${size} leading-[46px] tracking-tight ${tone}`}>
          {clock}
        </Numeral>
      </View>
      <Text className="text-[13px] text-ground/70">
        {remaining.expired
          ? "The deadline has passed"
          : "left to take or change a share"}
      </Text>
    </View>
  );
}

/**
 * How much of the window is gone, drawn as the band's own bottom edge draining
 * away -- so a deadline four days out never looks like one four minutes out.
 */
export function WindowRule({
  openedAt,
  deadlineAt,
}: {
  openedAt: string;
  deadlineAt: string;
}) {
  const now = useNow(RULE_TICK_MS);
  const elapsed = windowElapsedFraction(openedAt, deadlineAt, now);
  const urgent = isUrgent(timeRemaining(deadlineAt, now).totalMs);

  return (
    <View className="h-[3px] flex-row bg-table-edge" testID="WindowRule">
      <View
        className={urgent ? "h-full bg-brass" : "h-full bg-ground/50"}
        style={{ width: `${Math.round(elapsed * 100)}%` }}
      />
    </View>
  );
}
