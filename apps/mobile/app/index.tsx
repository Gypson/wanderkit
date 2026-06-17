import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ActionButton } from "../components/ActionButton";
import {
  clearAudioCache,
  getAudioCacheSummary,
  type AudioCacheSummary
} from "../lib/audioCache";
import {
  clearCachedPublishedTourManifests,
  listCachedPublishedTourManifests,
  type CachedManifestSummary
} from "../lib/manifestCache";
import {
  formatDisplayTimestamp,
  formatShortContentHash
} from "../lib/format";
import { sampleTourManifest } from "../lib/sampleTour";
import {
  clearVisitorResumeState,
  getVisitorResumeState,
  type VisitorResumeState
} from "../lib/visitorResume";

type CachePanelState =
  | { status: "loading" }
  | {
      audio: AudioCacheSummary;
      manifests: CachedManifestSummary[];
      message: string | null;
      status: "ready";
    }
  | { message: string; status: "error" };

export default function CodeEntryScreen() {
  const router = useRouter();
  const [tourCode, setTourCode] = useState(sampleTourManifest.tourCode);
  const [cacheState, setCacheState] = useState<CachePanelState>({
    status: "loading"
  });
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [resumeState, setResumeState] = useState<VisitorResumeState | null>(
    null
  );

  const openTourByCode = useCallback(
    (code: string) => {
      const normalizedCode = code.trim().toUpperCase();
      const safeCode = normalizedCode || sampleTourManifest.tourCode;
      router.push(`/tour/${encodeURIComponent(safeCode)}`);
    },
    [router]
  );

  const openTour = () => openTourByCode(tourCode);

  const openResumeStop = useCallback(() => {
    if (!resumeState?.lastStop) {
      return;
    }

    router.push(
      `/tour/${encodeURIComponent(
        resumeState.tourCode
      )}/stop/${encodeURIComponent(resumeState.lastStop.id)}`
    );
  }, [resumeState, router]);

  const refreshCacheState = useCallback(
    async (message: string | null = null) => {
      setCacheState({ status: "loading" });

      try {
        const [manifests, audio, resume] = await Promise.all([
          listCachedPublishedTourManifests(),
          getAudioCacheSummary(),
          getVisitorResumeState()
        ]);

        setResumeState(resume);
        setCacheState({
          status: "ready",
          manifests,
          audio,
          message
        });
      } catch (error) {
        setResumeState(null);
        setCacheState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Offline cache could not be loaded."
        });
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void refreshCacheState();
    }, [refreshCacheState])
  );

  const clearOfflineCache = async () => {
    setIsClearingCache(true);

    try {
      const [manifestCount, audio] = await Promise.all([
        clearCachedPublishedTourManifests(),
        clearAudioCache(),
        clearVisitorResumeState()
      ]);

      await refreshCacheState(
        `Cleared ${manifestCount} saved tour${
          manifestCount === 1 ? "" : "s"
        } and ${audio.fileCount} audio file${
          audio.fileCount === 1 ? "" : "s"
        }.`
      );
    } catch (error) {
      setCacheState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Offline cache could not be cleared."
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>WanderKit</Text>
          <Text style={styles.title}>Enter tour code</Text>
          <Text style={styles.subtitle}>
            Load a published city walk and choose any numbered stop.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Tour code</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setTourCode}
            placeholder="OLDTOWN"
            placeholderTextColor="#7b837c"
            style={styles.input}
            value={tourCode}
          />
          <Pressable onPress={openTour} style={styles.button}>
            <Text style={styles.buttonText}>Open tour</Text>
          </Pressable>
        </View>

        {resumeState ? (
          <ResumePanel
            onOpenRoute={() => openTourByCode(resumeState.tourCode)}
            onOpenStop={openResumeStop}
            resume={resumeState}
          />
        ) : null}

        <OfflineCachePanel
          isClearing={isClearingCache}
          onClear={() => void clearOfflineCache()}
          onOpenTour={openTourByCode}
          onRefresh={() => void refreshCacheState()}
          state={cacheState}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function OfflineCachePanel({
  isClearing,
  onClear,
  onOpenTour,
  onRefresh,
  state
}: {
  isClearing: boolean;
  onClear: () => void;
  onOpenTour: (tourCode: string) => void;
  onRefresh: () => void;
  state: CachePanelState;
}) {
  const hasCachedData =
    state.status === "ready" &&
    (state.manifests.length > 0 || state.audio.fileCount > 0);

  return (
    <View style={styles.cachePanel}>
      <View style={styles.cacheHeader}>
        <View>
          <Text style={styles.cacheEyebrow}>Offline cache</Text>
          <Text style={styles.cacheTitle}>Saved tours and audio</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {state.status === "loading" ? (
        <View style={styles.cacheLoading}>
          <ActivityIndicator color="#2d6a4f" />
          <Text style={styles.cacheBody}>Checking saved data.</Text>
        </View>
      ) : null}

      {state.status === "error" ? (
        <Text style={styles.cacheError}>{state.message}</Text>
      ) : null}

      {state.status === "ready" ? (
        <>
          <View style={styles.cacheStats}>
            <CacheStat
              label="Tours"
              value={String(state.manifests.length)}
            />
            <CacheStat
              label="Audio"
              value={`${state.audio.fileCount} file${
                state.audio.fileCount === 1 ? "" : "s"
              }`}
            />
            <CacheStat
              label="Size"
              value={formatBytes(state.audio.sizeBytes)}
            />
          </View>

          {state.manifests.length > 0 ? (
            <View style={styles.cachedTourList}>
              {state.manifests.slice(0, 3).map((manifest) => (
                <Pressable
                  accessibilityLabel={`Open ${manifest.title}`}
                  accessibilityRole="button"
                  key={manifest.tourCode}
                  onPress={() => onOpenTour(manifest.tourCode)}
                  style={({ pressed }) => [
                    styles.cachedTourRow,
                    pressed ? styles.cachedTourRowPressed : null
                  ]}
                >
                  <View style={styles.cachedTourText}>
                    <Text style={styles.cachedTourTitle}>{manifest.title}</Text>
                    <Text style={styles.cachedTourMeta}>
                      {manifest.city} - {manifest.stopCount} stops
                    </Text>
                    <Text style={styles.cachedTourDetail}>
                      {`Saved ${formatDisplayTimestamp(
                        manifest.cachedAt
                      )} - Published ${formatDisplayTimestamp(
                        manifest.publishedAt
                      )} - Hash ${formatShortContentHash(
                        manifest.contentHash
                      )}`}
                    </Text>
                  </View>
                  <View style={styles.cachedTourAction}>
                    <Text style={styles.cachedTourCode}>
                      {manifest.tourCode}
                    </Text>
                    <Text style={styles.cachedTourOpen}>Open</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.cacheBody}>
              Loaded tours and played audio will appear here.
            </Text>
          )}

          {state.message ? (
            <Text style={styles.cacheMessage}>{state.message}</Text>
          ) : null}

          <Pressable
            disabled={!hasCachedData || isClearing}
            onPress={onClear}
            style={[
              styles.clearButton,
              !hasCachedData || isClearing ? styles.clearButtonDisabled : null
            ]}
          >
            <Text style={styles.clearButtonText}>
              {isClearing ? "Clearing..." : "Clear offline data"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function ResumePanel({
  onOpenRoute,
  onOpenStop,
  resume
}: {
  onOpenRoute: () => void;
  onOpenStop: () => void;
  resume: VisitorResumeState;
}) {
  const hasStop = Boolean(resume.lastStop);
  const resumeText = resume.lastStop
    ? `Stop ${resume.lastStop.number}: ${resume.lastStop.title}`
    : "Route map";

  return (
    <View style={styles.resumePanel}>
      <View style={styles.resumeCopy}>
        <Text style={styles.resumeEyebrow}>Continue</Text>
        <Text style={styles.resumeTitle}>{resume.tourTitle}</Text>
        <Text style={styles.resumeBody}>
          {resumeText} - last opened {formatDisplayTimestamp(resume.updatedAt)}
        </Text>
        <Text style={styles.resumeMeta}>
          {resume.city} - {resume.tourCode}
        </Text>
      </View>
      <View style={styles.resumeActions}>
        <ActionButton
          iconName={hasStop ? "play" : "map"}
          label={hasStop ? "Continue stop" : "Continue route"}
          onPress={hasStop ? onOpenStop : onOpenRoute}
          variant="dark"
        />
        {hasStop ? (
          <ActionButton
            iconName="map"
            label="Open route"
            onPress={onOpenRoute}
          />
        ) : null}
      </View>
    </View>
  );
}

function CacheStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cacheStat}>
      <Text style={styles.cacheStatLabel}>{label}</Text>
      <Text style={styles.cacheStatValue}>{value}</Text>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / (1024 * 1024);

  if (megabytes < 0.1) {
    return "<0.1 MB";
  }

  return `${megabytes.toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbfaf7"
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 24
  },
  header: {
    paddingTop: 72
  },
  brand: {
    color: "#2d6a4f",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  title: {
    marginTop: 12,
    color: "#16202a",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0
  },
  subtitle: {
    marginTop: 12,
    color: "#53615a",
    fontSize: 17,
    lineHeight: 25
  },
  form: {
    marginTop: 40,
    gap: 12
  },
  label: {
    color: "#16202a",
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    borderColor: "#d7ded8",
    borderRadius: 8,
    borderWidth: 1,
    color: "#16202a",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  button: {
    alignItems: "center",
    backgroundColor: "#16202a",
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  resumePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d5ded8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    marginTop: 24,
    padding: 16
  },
  resumeCopy: {
    gap: 5
  },
  resumeEyebrow: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  resumeTitle: {
    color: "#16202a",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0
  },
  resumeBody: {
    color: "#53615a",
    fontSize: 14,
    lineHeight: 20
  },
  resumeMeta: {
    color: "#6d766f",
    fontSize: 12,
    fontWeight: "800"
  },
  resumeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  cachePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e6e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    marginTop: 28,
    padding: 16
  },
  cacheHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  cacheEyebrow: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  cacheTitle: {
    color: "#16202a",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4
  },
  refreshButton: {
    alignItems: "center",
    borderColor: "#d7ded8",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  refreshText: {
    color: "#2d6a4f",
    fontSize: 13,
    fontWeight: "800"
  },
  cacheLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  cacheBody: {
    color: "#53615a",
    fontSize: 14,
    lineHeight: 21
  },
  cacheError: {
    backgroundColor: "#fff0ec",
    borderRadius: 8,
    color: "#7a2f20",
    fontSize: 14,
    lineHeight: 20,
    padding: 10
  },
  cacheStats: {
    flexDirection: "row",
    gap: 8
  },
  cacheStat: {
    backgroundColor: "#fbfaf7",
    borderColor: "#e2e6e2",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10
  },
  cacheStatLabel: {
    color: "#53615a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  cacheStatValue: {
    color: "#16202a",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4
  },
  cachedTourList: {
    gap: 8
  },
  cachedTourRow: {
    alignItems: "center",
    backgroundColor: "#fbfaf7",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    padding: 10
  },
  cachedTourRowPressed: {
    opacity: 0.78
  },
  cachedTourText: {
    flex: 1,
    gap: 2
  },
  cachedTourTitle: {
    color: "#16202a",
    fontSize: 14,
    fontWeight: "800"
  },
  cachedTourMeta: {
    color: "#53615a",
    fontSize: 12
  },
  cachedTourDetail: {
    color: "#6d766f",
    fontSize: 11,
    lineHeight: 16
  },
  cachedTourAction: {
    alignItems: "flex-end",
    gap: 3
  },
  cachedTourCode: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800"
  },
  cachedTourOpen: {
    color: "#53615a",
    fontSize: 11,
    fontWeight: "800"
  },
  cacheMessage: {
    backgroundColor: "#eaf4f4",
    borderRadius: 8,
    color: "#2d6a4f",
    fontSize: 13,
    lineHeight: 19,
    padding: 10
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: "#fff0ec",
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center"
  },
  clearButtonDisabled: {
    opacity: 0.5
  },
  clearButtonText: {
    color: "#7a2f20",
    fontSize: 14,
    fontWeight: "800"
  }
});
