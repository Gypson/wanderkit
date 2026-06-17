import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ActionButtonVariant = "dark" | "danger" | "light";

export function ActionButton({
  disabled = false,
  iconName,
  label,
  onPress,
  variant = "light"
}: {
  disabled?: boolean;
  iconName: IconName;
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
}) {
  const contentColor = getContentColor(variant);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonVariantStyles[variant],
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Ionicons color={contentColor} name={iconName} size={17} />
      <Text style={[styles.label, labelVariantStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

function getContentColor(variant: ActionButtonVariant): string {
  if (variant === "dark") {
    return "#ffffff";
  }

  if (variant === "danger") {
    return "#7a2f20";
  }

  return "#2d6a4f";
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 13
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonPressed: {
    opacity: 0.78
  },
  label: {
    fontSize: 14,
    fontWeight: "800"
  }
});

const buttonVariantStyles = StyleSheet.create({
  danger: {
    backgroundColor: "#fff0ec",
    borderColor: "#f0b8aa"
  },
  dark: {
    backgroundColor: "#16202a",
    borderColor: "#16202a"
  },
  light: {
    backgroundColor: "#eaf4f4",
    borderColor: "#cfe3dc"
  }
});

const labelVariantStyles = StyleSheet.create({
  danger: {
    color: "#7a2f20"
  },
  dark: {
    color: "#ffffff"
  },
  light: {
    color: "#2d6a4f"
  }
});
