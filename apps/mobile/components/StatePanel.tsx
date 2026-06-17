import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

export type StatePanelTone = "danger" | "neutral" | "warning";

export function StatePanel({
  action,
  body,
  code,
  details,
  title,
  tone = "neutral"
}: {
  action?: ReactNode;
  body: string;
  code?: string;
  details?: string[];
  title: string;
  tone?: StatePanelTone;
}) {
  return (
    <View style={[styles.statePanel, statePanelToneStyles[tone]]}>
      {code ? <Text style={styles.code}>{code}</Text> : null}
      <Text style={[styles.stateTitle, stateTitleToneStyles[tone]]}>
        {title}
      </Text>
      <Text style={styles.stateBody}>{body}</Text>
      {details?.slice(0, 4).map((detail) => (
        <Text key={detail} style={styles.issueText}>
          {detail}
        </Text>
      ))}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statePanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 48,
    padding: 20
  },
  code: {
    alignSelf: "flex-start",
    backgroundColor: "#eaf4f4",
    borderRadius: 6,
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  stateTitle: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 0
  },
  stateBody: {
    color: "#53615a",
    fontSize: 16,
    lineHeight: 24
  },
  issueText: {
    backgroundColor: "#fbfaf7",
    borderRadius: 6,
    color: "#7a2f20",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  stateAction: {
    alignItems: "flex-start",
    paddingTop: 4
  }
});

const statePanelToneStyles = StyleSheet.create({
  danger: {
    backgroundColor: "#fff0ec",
    borderColor: "#f0b8aa"
  },
  neutral: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e6e2"
  },
  warning: {
    backgroundColor: "#fff6df",
    borderColor: "#ead39b"
  }
});

const stateTitleToneStyles = StyleSheet.create({
  danger: {
    color: "#7a2f20"
  },
  neutral: {
    color: "#16202a"
  },
  warning: {
    color: "#7a4d10"
  }
});
