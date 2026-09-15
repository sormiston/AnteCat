import { Numeral } from "@/components/shared/Numeral";
import { formatEuroCents } from "@/domain/pricing";
import { projectStake } from "@/domain/stakes";
import type { OrderItemView } from "@/features/orders/view";
import { unitCount } from "@/lib/format";
import { failureKindOf } from "@/lib/queryErrors";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * The only place in the app a stake is written.
 *
 * Stepping adjusts a draft and commits on one press, rather than writing on
 * every tap. A stake is a commitment other people plan around, so it should
 * take a deliberate act -- and on a tiered item every write reprices every
 * other member's stake and wakes both other devices, which is not a thing to
 * do four times while somebody makes up their mind.
 *
 * The figure beside the stepper is what they would owe if they committed now,
 * priced at the tier the item would land on -- not the one it sits on. On a
 * tiered item those differ, and the difference is the entire pitch.
 */
export function StakeStepper({
  item,
  onCommit,
  onWithdraw,
  onEdit,
  isPending,
  error,
}: {
  item: OrderItemView;
  onCommit: (qty: number) => void;
  onWithdraw: () => void;
  /** Fired on any step, so a new decision isn't made under an old failure. */
  onEdit: () => void;
  isPending: boolean;
  error: unknown;
}) {
  const committed = item.viewerStake?.qty ?? 0;
  const [draft, setDraft] = useState(committed);

  // Resync when the server's figure moves under us -- after a commit lands, or
  // if this member changes their share on another device. Only their own stake
  // can move this number, so a resync can never discard an edit in progress.
  const [lastCommitted, setLastCommitted] = useState(committed);
  if (committed !== lastCommitted) {
    setLastCommitted(committed);
    setDraft(committed);
  }

  const ceiling = item.viewerHeadroom;

  // Headroom can shrink under a draft: the item fills while somebody is still
  // deciding, which is the normal case when three people share one pack. Take
  // the draft down with it rather than leaving a button armed for a write the
  // database is now certain to refuse.
  const draftQty = ceiling === null ? draft : Math.min(draft, ceiling);

  const canAdd = !isPending && (ceiling === null || draftQty < ceiling);
  const canRemove = !isPending && draftQty > 0;
  const dirty = draftQty !== committed;

  const step = (next: number) => {
    onEdit();
    setDraft(next);
  };

  const projection = projectStake({
    pricingType: item.pricingType,
    draftQty,
    committedQty: committed,
    itemQuantity: item.quantity,
    tiers: item.tiers,
    bundle: item.bundle,
  });

  const fillsPack =
    item.pricingType === "threshold_bundle" &&
    item.bundle !== null &&
    projection.itemQuantity === item.bundle.thresholdQty &&
    item.quantity !== item.bundle.thresholdQty;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-row items-center gap-4">
          <StepButton
            label="One less"
            glyph="−"
            enabled={canRemove}
            onPress={() => step(Math.max(0, draftQty - 1))}
          />
          <View className="min-w-[64px] items-center">
            <Numeral className="text-[30px] leading-[34px] font-semibold text-ink">
              {draftQty}
            </Numeral>
            <Text className="text-[12px] text-dusk">
              {draftQty === 1 ? "unit" : "units"}
            </Text>
          </View>
          <StepButton
            label="One more"
            glyph="+"
            enabled={canAdd}
            onPress={() => step(draftQty + 1)}
          />
        </View>

        <View className="items-end">
          <Numeral className="text-[21px] font-semibold text-ante-deep">
            {projection.amountCents === null
              ? "—"
              : formatEuroCents(projection.amountCents)}
          </Numeral>
          <Text className="text-[12px] text-dusk">
            {dirty ? "you'd owe" : "you owe"}
          </Text>
        </View>
      </View>

      {/* The one moment a tiered item's promise becomes a specific number. */}
      {projection.unlocksCheaperTier && projection.unitPriceCents !== null ? (
        <Text className="text-[13px] leading-[18px] text-ink-soft">
          This is the unit that drops everyone to{" "}
          {formatEuroCents(projection.unitPriceCents)} each.
        </Text>
      ) : null}
      {fillsPack ? (
        <Text className="text-[13px] leading-[18px] text-ink-soft">
          This completes the pack.
        </Text>
      ) : null}
      {!canAdd && ceiling !== null && draftQty >= ceiling && !isPending ? (
        <Text className="text-[13px] leading-[18px] text-dusk">
          {ceiling === 0
            ? "This one is full. Nothing left to take."
            : ceiling === committed
              ? "You're holding everything that's left here."
              : `${unitCount(ceiling)} is all the room this item has for you.`}
        </Text>
      ) : null}

      <CommitButton
        draft={draftQty}
        committed={committed}
        amountCents={projection.amountCents}
        dirty={dirty}
        isPending={isPending}
        onPress={() => (draftQty === 0 ? onWithdraw() : onCommit(draftQty))}
      />

      {committed > 0 && draftQty === committed && !isPending ? (
        <Pressable
          accessibilityRole="button"
          onPress={onWithdraw}
          className="self-start px-1 py-1"
        >
          <Text className="text-[13px] text-dusk underline">
            Withdraw from this item
          </Text>
        </Pressable>
      ) : null}

      {error ? <WriteFailure error={error} /> : null}
    </View>
  );
}

function StepButton({
  label,
  glyph,
  enabled,
  onPress,
}: {
  label: string;
  glyph: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      className={`h-[46px] w-[46px] items-center justify-center rounded-[4px] border ${
        enabled ? "border-ink bg-white active:bg-ground" : "border-rule bg-transparent"
      }`}
    >
      <Text
        className={`text-[22px] leading-[26px] ${
          enabled ? "text-ink" : "text-rule"
        }`}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

/**
 * Orange, because it is the viewer committing something of their own -- the
 * same rule that colours their chips and their figures. It says what pressing
 * it does and what it costs, so nothing is confirmed blind.
 */
function CommitButton({
  draft,
  committed,
  amountCents,
  dirty,
  isPending,
  onPress,
}: {
  draft: number;
  committed: number;
  amountCents: number | null;
  dirty: boolean;
  isPending: boolean;
  onPress: () => void;
}) {
  const money = amountCents === null ? null : formatEuroCents(amountCents);
  const label = !dirty
    ? committed === 0
      ? "Take a share"
      : "Your share is up to date"
    : draft === 0
      ? "Withdraw your share"
      : committed === 0
        ? `Take ${unitCount(draft)}${money ? ` — ${money}` : ""}`
        : `Change to ${unitCount(draft)}${money ? ` — ${money}` : ""}`;

  const enabled = dirty && !isPending;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, busy: isPending }}
      disabled={!enabled}
      onPress={onPress}
      className={`items-center rounded-[4px] px-4 py-[13px] ${
        enabled ? "bg-ante active:bg-ante-deep" : "bg-rule"
      }`}
    >
      <Text
        className={`text-[15px] font-semibold ${
          enabled ? "text-white" : "text-dusk"
        }`}
      >
        {isPending ? "Sending…" : label}
      </Text>
    </Pressable>
  );
}

/**
 * A failed write, said from the ledger's side: the first thing a member needs
 * to know is that nothing moved, not what the database called it.
 */
function WriteFailure({ error }: { error: unknown }) {
  const kind = failureKindOf(error);
  const message =
    kind === "rejected"
      ? "That didn't land — the table moved while you were deciding. The figures above are current."
      : kind === "network"
        ? "Couldn't reach the table. Your share is unchanged."
        : "Something went wrong. Your share is unchanged.";

  return (
    <View className="rounded-[3px] border border-rule bg-ground px-3 py-[10px]">
      <Text className="text-[13px] leading-[18px] text-ink-soft">{message}</Text>
    </View>
  );
}
