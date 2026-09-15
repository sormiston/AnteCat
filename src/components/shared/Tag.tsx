import { Text, View } from "react-native";

export type TagTone = "table" | "ante" | "dusk" | "onTable";

// A squared tag, not a pill: these label a state in a ledger, and a ledger's
// marks are rectangular. Tone carries the meaning, so the text never has to
// repeat it ("Succeeded", not "Status: succeeded").
const TONES: Record<TagTone, { box: string; label: string }> = {
  table: { box: "border-table bg-table", label: "text-ground" },
  ante: { box: "border-ante bg-ante", label: "text-white" },
  dusk: { box: "border-rule bg-transparent", label: "text-dusk" },
  // Drawn on the header band, where the page's own borders would disappear.
  onTable: { box: "border-table-edge bg-table-edge", label: "text-ground" },
};

export function Tag({ label, tone = "dusk" }: { label: string; tone?: TagTone }) {
  const { box, label: labelClass } = TONES[tone];

  return (
    <View className={`rounded-[2px] border px-2 py-[3px] ${box}`}>
      <Text className={`text-[11px] font-semibold tracking-wide ${labelClass}`}>
        {label}
      </Text>
    </View>
  );
}
