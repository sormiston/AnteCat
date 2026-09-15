import { useCloseOrder, useExecuteOrder } from "@/features/orders/api";
import type { Database } from "@/lib/database.types";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * The admin's two one-way moves. Rendered inline rather than behind a
 * role-guard component -- it is one conditional (SPEC.md's Component
 * Inventory).
 *
 * Both are irreversible: trg_order_status_transition only ever moves status
 * forward. So each one arms first and commits on a second press, which is a
 * confirmation that works the same on iOS, Android and web -- Alert.alert does
 * nothing at all on web, and this demo runs on all three at once.
 */
const DISARM_AFTER_MS = 6000;

export function AdminOrderActions({
  orderId,
  status,
}: {
  orderId: number;
  status: OrderStatus;
}) {
  const close = useCloseOrder(orderId);
  const execute = useExecuteOrder(orderId);

  if (status === "executed") {
    return (
      <Note>
        This order is finished. Every share below is what each member owes you.
      </Note>
    );
  }

  if (status === "closed") {
    return (
      <Action
        prompt="Mark this bought once you've paid the vendor. It's a record for the group, nothing else changes."
        label="Mark as bought"
        confirmLabel="Yes, mark it bought"
        pending={execute.isPending}
        error={execute.error}
        onConfirm={() => execute.mutate()}
      />
    );
  }

  return (
    <Action
      prompt="Closing now ends the deadline early, settles every complete pack to the cent, and stops anyone changing their share."
      label="Close the order early"
      confirmLabel="Yes, close it now"
      pending={close.isPending}
      error={close.error}
      onConfirm={() => close.mutate()}
    />
  );
}

function Action({
  prompt,
  label,
  confirmLabel,
  pending,
  error,
  onConfirm,
}: {
  prompt: string;
  label: string;
  confirmLabel: string;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  // Disarms itself, so a card tapped by accident doesn't sit one press away
  // from an irreversible move for the rest of the session.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_AFTER_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <View className="gap-3 border-t border-rule px-4 pb-10 pt-5">
      <Text className="text-[13px] leading-[19px] text-dusk">{prompt}</Text>

      {armed ? (
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={onConfirm}
            className="flex-1 flex-row items-center justify-center rounded-[3px] bg-ante px-4 py-3 active:bg-ante-deep"
          >
            {pending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-[15px] font-semibold text-white">
                {confirmLabel}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setArmed(false)}
            className="px-3 py-3"
          >
            <Text className="text-[14px] text-dusk">Not yet</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setArmed(true)}
          className="items-center rounded-[3px] border border-ink px-4 py-3 active:bg-ink/5"
        >
          <Text className="text-[15px] font-semibold text-ink">{label}</Text>
        </Pressable>
      )}

      {error ? (
        <Text className="text-[13px] text-ante-deep">
          That didn&apos;t go through: {error.message}
        </Text>
      ) : null}
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <View className="border-t border-rule px-4 pb-10 pt-5">
      <Text className="text-[13px] leading-[19px] text-dusk">{children}</Text>
    </View>
  );
}
