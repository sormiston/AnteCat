import type { FailureKind } from "@/lib/queryErrors";
import { Pressable, Text, View } from "react-native";

/**
 * The three states every screen needs, kept together because they share one
 * frame and are meant to look like siblings.
 *
 * An empty screen and a failed one are different jobs: empty says what will
 * appear here and who puts it there, failure says what went wrong and whether
 * trying again is worth anything.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <View className="items-start gap-2 px-5 py-14" testID="Frame">
      {children}
    </View>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[19px] font-semibold text-ink" testID="Title">
      {children}
    </Text>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="max-w-[420px] text-[14px] leading-[21px] text-ink-soft"
      testID="Body"
    >
      {children}
    </Text>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Frame>
      <Title>{title}</Title>
      <Body>{message}</Body>
    </Frame>
  );
}

// Retrying a permission problem just fails again, so the button only appears
// where it can actually change the outcome.
const FAILURES: Record<
  FailureKind,
  { title: string; message: string; retryable: boolean }
> = {
  network: {
    title: "Can't reach the table",
    message:
      "The order is there, this device just can't see it right now. Check your connection and try again.",
    retryable: true,
  },
  notAuthorized: {
    title: "Not your table",
    message:
      "This order belongs to a syndicate you're not a member of. Ask its admin to add you.",
    retryable: false,
  },
  rejected: {
    title: "That move didn't land",
    message:
      "The table moved before your change did \u2014 the pack filled, or the order closed. What's on screen now is where it stands.",
    retryable: false,
  },
  notFound: {
    title: "No such order",
    message: "This order has been removed, or the link points somewhere that never existed.",
    retryable: false,
  },
  unknown: {
    title: "Something went wrong",
    message: "The order didn't load. Try again, and tell whoever runs the demo if it keeps happening.",
    retryable: true,
  },
};

export function ErrorState({
  kind,
  onRetry,
}: {
  kind: FailureKind;
  onRetry?: () => void;
}) {
  const { title, message, retryable } = FAILURES[kind];

  return (
    <Frame>
      <Title>{title}</Title>
      <Body>{message}</Body>
      {retryable && onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-3 rounded-[3px] border border-ink px-4 py-2 active:bg-ink/5"
        >
          <Text className="text-[14px] font-semibold text-ink">Try again</Text>
        </Pressable>
      ) : null}
    </Frame>
  );
}

/** Two card-shaped placeholders. Deliberately still -- a shimmer would be the only unprompted motion in the app. */
export function LoadingSkeleton() {
  return (
    <View className="gap-3 px-4 py-4" testID="LoadingSkeleton">
      {[0, 1].map((key) => (
        <View
          key={key}
          className="gap-3 rounded-[6px] border border-rule bg-paper p-4"
        >
          <View className="h-[17px] w-1/2 rounded-[2px] bg-rule" />
          <View className="h-[13px] w-3/4 rounded-[2px] bg-rule/60" />
          <View className="h-[15px] w-1/3 rounded-[2px] bg-rule/60" />
        </View>
      ))}
    </View>
  );
}
