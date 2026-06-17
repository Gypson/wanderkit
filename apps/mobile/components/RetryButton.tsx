import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

export function RetryButton({
  label = "Retry lookup",
  onPress
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.buttonPressed : null
      ]}
    >
      <Ionicons color="#2d6a4f" name="refresh" size={17} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#eaf4f4",
    borderColor: "#cfe3dc",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 13
  },
  buttonPressed: {
    opacity: 0.78
  },
  label: {
    color: "#2d6a4f",
    fontSize: 14,
    fontWeight: "800"
  }
});
