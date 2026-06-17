import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "./ActionButton";
import {
  formatDisplayTimestamp,
  formatShortContentHash
} from "../lib/format";

type CachedManifestReason = "config-missing" | "network-error";

export function CachedManifestNotice({
  cachedAt,
  contentHash,
  isRefreshing = false,
  onRefresh,
  publishedAt,
  reason,
  title = "Saved tour copy"
}: {
  cachedAt: string | null;
  contentHash: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  publishedAt: string;
  reason: CachedManifestReason;
  title?: string;
}) {
  return (
    <View style={styles.cacheBanner}>
      <Text style={styles.cacheTitle}>{title}</Text>
      <Text style={styles.cacheBody}>
        {reason === "config-missing"
          ? "Supabase is not configured, so WanderKit is using the saved manifest on this device."
          : "The live lookup failed, so WanderKit is using the saved manifest on this device."}
      </Text>
      <View style={styles.cacheMetaRow}>
        <CacheMeta label="Saved" value={formatDisplayTimestamp(cachedAt)} />
        <CacheMeta
          label="Published"
          value={formatDisplayTimestamp(publishedAt)}
        />
        <CacheMeta label="Hash" value={formatShortContentHash(contentHash)} />
      </View>
      {onRefresh ? (
        <ActionButton
          disabled={isRefreshing}
          iconName="refresh"
          label={isRefreshing ? "Checking..." : "Check for updates"}
          onPress={onRefresh}
        />
      ) : null}
    </View>
  );
}

function CacheMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cacheMetaPill}>
      <Text style={styles.cacheMetaLabel}>{label}</Text>
      <Text style={styles.cacheMetaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cacheBanner: {
    backgroundColor: "#fff6df",
    borderColor: "#ead39b",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 14
  },
  cacheTitle: {
    color: "#7a4d10",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  cacheBody: {
    color: "#5f4b2a",
    fontSize: 14,
    lineHeight: 20
  },
  cacheMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  cacheMetaPill: {
    backgroundColor: "#fffaf0",
    borderColor: "#ead39b",
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  cacheMetaLabel: {
    color: "#7a4d10",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  cacheMetaValue: {
    color: "#3f321c",
    fontSize: 12,
    fontWeight: "800"
  }
});
