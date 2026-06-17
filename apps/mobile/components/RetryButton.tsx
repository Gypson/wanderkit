import { ActionButton } from "./ActionButton";

export function RetryButton({
  label = "Retry lookup",
  onPress
}: {
  label?: string;
  onPress: () => void;
}) {
  return <ActionButton iconName="refresh" label={label} onPress={onPress} />;
}
