import { Platform, Text, type TextProps } from "react-native";

/**
 * Money and tallies. Not a label style -- a ledger's figures have to line up
 * column to column, and `tabular-nums` is what stops a 1 being narrower than a
 * 7 while a countdown ticks.
 *
 * Set in JS rather than as a Tailwind fontFamily token: NativeWind's
 * platformSelect writes itself into the web stylesheet unresolved, so the face
 * silently never applied. Platform.select here resolves in all three runtimes,
 * and web takes the whole stack.
 */
const FIGURE_FACE = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
});

export function Numeral({ style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[{ fontFamily: FIGURE_FACE, fontVariant: ["tabular-nums"] }, style]}
    />
  );
}
