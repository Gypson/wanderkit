import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CachedManifestNotice } from "../../components/CachedManifestNotice";
import { RetryButton } from "../../components/RetryButton";
import type { PublishedStop, PublishedTourManifest } from "@wanderkit/shared";
import { StatePanel } from "../../components/StatePanel";
import { TourMap } from "../../components/TourMap";
import type { TourLookupState } from "../../lib/tourLookup";
import { useTourLookup } from "../../lib/useTourLookup";
import { saveVisitorResumeTour } from "../../lib/visitorResume";

export default function TourScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { lookupState, normalizedCode, retryLookup } = useTourLookup(code);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <TourLookupContent
          onRetry={() => void retryLookup()}
          state={lookupState}
          tourCode={normalizedCode}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TourLookupContent({
  onRetry,
  state,
  tourCode
}: {
  onRetry: () => void;
  state: TourLookupState;
  tourCode: string;
}) {
  if (state.status === "loading") {
    return (
      <StatePanel
        action={<ActivityIndicator color="#2d6a4f" />}
        body={`Looking up ${tourCode}.`}
        title="Loading tour"
      />
    );
  }

  if (state.status === "config-missing") {
    return (
      <StatePanel
        action={<RetryButton onPress={onRetry} />}
        body="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to load published manifests."
        code={tourCode}
        title="Supabase is not configured"
        tone="warning"
      />
    );
  }

  if (state.status === "not-found") {
    return (
      <StatePanel
        action={<RetryButton onPress={onRetry} />}
        body="No published tour exists for this code."
        code={state.code}
        title="Tour not found"
      />
    );
  }

  if (state.status === "invalid") {
    return (
      <StatePanel
        action={<RetryButton onPress={onRetry} />}
        body="This code returned JSON, but it does not match the published manifest contract."
        code={state.code}
        details={state.issues}
        title="Manifest is invalid"
        tone="warning"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel
        action={<RetryButton onPress={onRetry} />}
        body={state.message}
        code={tourCode}
        title="Could not load tour"
        tone="danger"
      />
    );
  }

  return (
    <PublishedTourView
      cacheMetadata={
        state.status === "cached"
          ? { cachedAt: state.cachedAt, reason: state.reason }
          : null
      }
      manifest={state.manifest}
    />
  );
}

function PublishedTourView({
  cacheMetadata,
  manifest
}: {
  cacheMetadata: {
    cachedAt: string | null;
    reason: "config-missing" | "network-error";
  } | null;
  manifest: PublishedTourManifest;
}) {
  const router = useRouter();
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const selectedStop = useMemo(
    () =>
      manifest.stops.find((stop) => stop.id === selectedStopId) ??
      manifest.stops[0],
    [manifest.stops, selectedStopId]
  );

  useEffect(() => {
    saveVisitorResumeTour(manifest).catch(() => {
      // Resume state should not block rendering a valid tour.
    });
  }, [manifest]);

  const openStop = (stop: PublishedStop) => {
    router.push(
      `/tour/${encodeURIComponent(manifest.tourCode)}/stop/${encodeURIComponent(
        stop.id
      )}`
    );
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.code}>{manifest.tourCode}</Text>
        <Text style={styles.title}>{manifest.title}</Text>
        <Text style={styles.description}>{manifest.description}</Text>
      </View>

      {cacheMetadata ? (
        <CachedManifestNotice
          cachedAt={cacheMetadata.cachedAt}
          contentHash={manifest.contentHash}
          publishedAt={manifest.publishedAt}
          reason={cacheMetadata.reason}
        />
      ) : null}

      <TourMap
        onStopPress={openStop}
        route={manifest.route}
        selectedStopId={selectedStop?.id}
        stops={manifest.stops}
      />

      {selectedStop ? <SelectedStopPanel stop={selectedStop} /> : null}

      <View style={styles.stopList}>
        {manifest.stops.map((stop) => (
          <Pressable
            key={stop.id}
            onPress={() => setSelectedStopId(stop.id)}
            style={[
              styles.stopRow,
              selectedStop?.id === stop.id ? styles.stopRowSelected : null
            ]}
          >
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{stop.number}</Text>
            </View>
            <View style={styles.stopText}>
              <Text style={styles.stopTitle}>{stop.title}</Text>
              <Text style={styles.stopSummary}>{stop.summary}</Text>
            </View>
            <Pressable
              onPress={() => openStop(stop)}
              style={styles.playButton}
            >
              <Text style={styles.playLabel}>Play</Text>
            </Pressable>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function SelectedStopPanel({ stop }: { stop: PublishedStop }) {
  return (
    <View style={styles.selectedPanel}>
      <View style={styles.selectedHeader}>
        <Text style={styles.selectedNumber}>Stop {stop.number}</Text>
        <Text style={styles.selectedDuration}>
          {formatDuration(stop.audioDurationSeconds)}
        </Text>
      </View>
      <Text style={styles.selectedTitle}>{stop.title}</Text>
      <Text style={styles.selectedSummary}>{stop.summary}</Text>
    </View>
  );
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) {
    return "Audio";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbfaf7"
  },
  content: {
    padding: 24,
    paddingBottom: 40
  },
  header: {
    gap: 8
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
  title: {
    color: "#16202a",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0
  },
  description: {
    color: "#53615a",
    fontSize: 16,
    lineHeight: 24
  },
  selectedPanel: {
    backgroundColor: "#16202a",
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
    padding: 16
  },
  selectedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  selectedNumber: {
    color: "#a9d8c4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  selectedDuration: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  selectedTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0
  },
  selectedSummary: {
    color: "#dbe7df",
    fontSize: 15,
    lineHeight: 22
  },
  stopList: {
    gap: 12,
    marginTop: 20
  },
  stopRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e6e2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 82,
    padding: 14
  },
  stopRowSelected: {
    borderColor: "#2d6a4f",
    borderWidth: 2
  },
  stopNumber: {
    alignItems: "center",
    backgroundColor: "#16202a",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  stopNumberText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  stopText: {
    flex: 1,
    gap: 3
  },
  stopTitle: {
    color: "#16202a",
    fontSize: 16,
    fontWeight: "800"
  },
  stopSummary: {
    color: "#53615a",
    fontSize: 14,
    lineHeight: 20
  },
  playLabel: {
    color: "#2d6a4f",
    fontSize: 14,
    fontWeight: "800"
  },
  playButton: {
    alignItems: "center",
    backgroundColor: "#eaf4f4",
    borderRadius: 8,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  }
});
