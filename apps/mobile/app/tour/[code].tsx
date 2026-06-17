import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ActionButton } from "../../components/ActionButton";
import { CachedManifestNotice } from "../../components/CachedManifestNotice";
import { RetryButton } from "../../components/RetryButton";
import type { PublishedStop, PublishedTourManifest } from "@wanderkit/shared";
import { StatePanel } from "../../components/StatePanel";
import { TourMap } from "../../components/TourMap";
import {
  downloadAudioForStop,
  getCachedAudioStatuses,
  type AudioCacheStatus,
  type AudioCacheStatusByStopId
} from "../../lib/audioCache";
import { formatDisplayTimestamp } from "../../lib/format";
import {
  clearTourProgressState,
  createEmptyTourProgress,
  getProgressSummary,
  getTourProgressState,
  isStopPlayed,
  type TourProgressState
} from "../../lib/tourProgress";
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
  const [progress, setProgress] = useState<TourProgressState>(() =>
    createEmptyTourProgress(manifest.tourCode)
  );
  const [audioStatuses, setAudioStatuses] = useState<AudioCacheStatusByStopId>(
    {}
  );
  const [audioDownloadMessage, setAudioDownloadMessage] = useState<
    string | null
  >(null);
  const [downloadingStopId, setDownloadingStopId] = useState<string | null>(
    null
  );
  const [tourAudioDownload, setTourAudioDownload] = useState<{
    message: string | null;
    processedCount: number;
    status: "idle" | "running";
  }>({
    message: null,
    processedCount: 0,
    status: "idle"
  });
  const [isResettingProgress, setIsResettingProgress] = useState(false);
  const selectedStop = useMemo(
    () =>
      manifest.stops.find((stop) => stop.id === selectedStopId) ??
      manifest.stops[0],
    [manifest.stops, selectedStopId]
  );
  const playedStopIdSet = useMemo(
    () => new Set(progress.playedStopIds),
    [progress.playedStopIds]
  );
  const playedCount = manifest.stops.filter((stop) =>
    playedStopIdSet.has(stop.id)
  ).length;
  const isTourComplete =
    manifest.stops.length > 0 && playedCount === manifest.stops.length;
  const audioSavedCount = manifest.stops.filter(
    (stop) => audioStatuses[stop.id] === "downloaded"
  ).length;
  const isAudioDownloadUnavailable =
    manifest.stops.length > 0 &&
    manifest.stops.every((stop) => audioStatuses[stop.id] === "unavailable");
  const isAllAudioSaved =
    manifest.stops.length > 0 && audioSavedCount === manifest.stops.length;

  useEffect(() => {
    setAudioDownloadMessage(null);
  }, [selectedStopId]);

  useEffect(() => {
    saveVisitorResumeTour(manifest).catch(() => {
      // Resume state should not block rendering a valid tour.
    });
  }, [manifest]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      Promise.all([
        getTourProgressState(manifest.tourCode),
        getCachedAudioStatuses({
          stops: manifest.stops,
          tourCode: manifest.tourCode
        })
      ])
        .then(([nextProgress, nextAudioStatuses]) => {
          if (isMounted) {
            setProgress(nextProgress);
            setAudioStatuses(nextAudioStatuses);
            setTourAudioDownload((currentDownload) =>
              currentDownload.status === "running"
                ? currentDownload
                : {
                    message: null,
                    processedCount: 0,
                    status: "idle"
                  }
            );
          }
        })
        .catch(() => {
          if (isMounted) {
            setProgress(createEmptyTourProgress(manifest.tourCode));
            setAudioStatuses({});
          }
        });

      return () => {
        isMounted = false;
      };
    }, [manifest.stops, manifest.tourCode])
  );

  const openStop = (stop: PublishedStop) => {
    router.push(
      `/tour/${encodeURIComponent(manifest.tourCode)}/stop/${encodeURIComponent(
        stop.id
      )}`
    );
  };

  const resetProgress = async () => {
    setIsResettingProgress(true);

    try {
      await clearTourProgressState(manifest.tourCode);
      setProgress(createEmptyTourProgress(manifest.tourCode));
    } finally {
      setIsResettingProgress(false);
    }
  };

  const downloadStopAudio = async (stop: PublishedStop) => {
    setAudioDownloadMessage(null);
    setDownloadingStopId(stop.id);

    try {
      const result = await downloadAudioForStop({
        audioUrl: stop.audioUrl,
        stopId: stop.id,
        tourCode: manifest.tourCode
      });

      setAudioStatuses((currentStatuses) => ({
        ...currentStatuses,
        [stop.id]: result.status
      }));
      setAudioDownloadMessage(result.message);
    } catch (error) {
      setAudioDownloadMessage(
        error instanceof Error
          ? error.message
          : "Audio could not be downloaded."
      );
    } finally {
      setDownloadingStopId(null);
    }
  };

  const downloadAllAudio = async () => {
    setAudioDownloadMessage(null);
    setTourAudioDownload({
      message: null,
      processedCount: 0,
      status: "running"
    });

    let savedCount = 0;
    let unavailableCount = 0;
    let failedCount = 0;

    try {
      for (const [index, stop] of manifest.stops.entries()) {
        let nextStatus: AudioCacheStatus | null = null;

        try {
          const result = await downloadAudioForStop({
            audioUrl: stop.audioUrl,
            stopId: stop.id,
            tourCode: manifest.tourCode
          });

          nextStatus = result.status;

          if (result.status === "downloaded") {
            savedCount += 1;
          } else if (result.status === "unavailable") {
            unavailableCount += 1;
          } else {
            failedCount += 1;
          }
        } catch {
          failedCount += 1;
        }

        if (nextStatus) {
          setAudioStatuses((currentStatuses) => ({
            ...currentStatuses,
            [stop.id]: nextStatus
          }));
        }

        setTourAudioDownload({
          message: `Checked ${index + 1} of ${manifest.stops.length} stops.`,
          processedCount: index + 1,
          status: "running"
        });
      }

      setTourAudioDownload({
        message: formatDownloadAllMessage({
          failedCount,
          savedCount,
          unavailableCount
        }),
        processedCount: manifest.stops.length,
        status: "idle"
      });
    } catch (error) {
      setTourAudioDownload({
        message:
          error instanceof Error
            ? error.message
            : "Audio downloads could not be completed.",
        processedCount: savedCount + failedCount + unavailableCount,
        status: "idle"
      });
    }
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

      <TourProgressPanel
        completedAt={progress.completedAt}
        isComplete={isTourComplete}
        isResetting={isResettingProgress}
        onReset={() => {
          resetProgress().catch(() => {
            setIsResettingProgress(false);
          });
        }}
        playedCount={playedCount}
        stopCount={manifest.stops.length}
      />

      <TourAudioDownloadPanel
        isAllSaved={isAllAudioSaved}
        isRunning={tourAudioDownload.status === "running"}
        isUnavailable={isAudioDownloadUnavailable}
        message={tourAudioDownload.message}
        onDownloadAll={() => {
          downloadAllAudio().catch((error) => {
            setTourAudioDownload({
              message:
                error instanceof Error
                  ? error.message
                  : "Audio downloads could not be completed.",
              processedCount: 0,
              status: "idle"
            });
          });
        }}
        processedCount={tourAudioDownload.processedCount}
        savedCount={audioSavedCount}
        stopCount={manifest.stops.length}
      />

      <TourMap
        onStopPress={openStop}
        route={manifest.route}
        selectedStopId={selectedStop?.id}
        stops={manifest.stops}
      />

      {selectedStop ? (
        <SelectedStopPanel
          audioStatus={audioStatuses[selectedStop.id] ?? "unavailable"}
          downloadMessage={audioDownloadMessage}
          isPlayed={isStopPlayed(progress, selectedStop.id)}
          isDownloadingAudio={downloadingStopId === selectedStop.id}
          onDownloadAudio={() => {
            downloadStopAudio(selectedStop).catch((error) => {
              setAudioDownloadMessage(
                error instanceof Error
                  ? error.message
                  : "Audio could not be downloaded."
              );
              setDownloadingStopId(null);
            });
          }}
          stop={selectedStop}
        />
      ) : null}

      <View style={styles.stopList}>
        {manifest.stops.map((stop) => {
          const stopPlayed = playedStopIdSet.has(stop.id);
          const audioStatus = audioStatuses[stop.id] ?? "unavailable";

          return (
            <Pressable
              key={stop.id}
              onPress={() => setSelectedStopId(stop.id)}
              style={[
                styles.stopRow,
                stopPlayed ? styles.stopRowPlayed : null,
                selectedStop?.id === stop.id ? styles.stopRowSelected : null
              ]}
            >
              <View
                style={[
                  styles.stopNumber,
                  stopPlayed ? styles.stopNumberPlayed : null
                ]}
              >
                {stopPlayed ? (
                  <Ionicons color="#ffffff" name="checkmark" size={17} />
                ) : (
                  <Text style={styles.stopNumberText}>{stop.number}</Text>
                )}
              </View>
              <View style={styles.stopText}>
                <Text style={styles.stopTitle}>{stop.title}</Text>
                <View style={styles.stopStatusRow}>
                  <StopStatusPill
                    label={stopPlayed ? "Played" : "Not played"}
                    tone={stopPlayed ? "success" : "neutral"}
                  />
                  <StopStatusPill
                    label={formatAudioStatusLabel(audioStatus)}
                    tone={audioStatus === "downloaded" ? "success" : "neutral"}
                  />
                </View>
                <Text style={styles.stopSummary}>{stop.summary}</Text>
              </View>
              <Pressable
                onPress={() => openStop(stop)}
                style={styles.playButton}
              >
                <Text style={styles.playLabel}>Play</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function TourAudioDownloadPanel({
  isAllSaved,
  isRunning,
  isUnavailable,
  message,
  onDownloadAll,
  processedCount,
  savedCount,
  stopCount
}: {
  isAllSaved: boolean;
  isRunning: boolean;
  isUnavailable: boolean;
  message: string | null;
  onDownloadAll: () => void;
  processedCount: number;
  savedCount: number;
  stopCount: number;
}) {
  const action = getDownloadAllAction({
    isAllSaved,
    isRunning,
    isUnavailable,
    stopCount
  });

  return (
    <View style={styles.downloadPanel}>
      <View style={styles.downloadCopy}>
        <Text style={styles.downloadEyebrow}>Audio downloads</Text>
        <Text style={styles.downloadTitle}>
          {savedCount} of {stopCount} stops saved
        </Text>
        <Text style={styles.downloadBody}>
          {isRunning
            ? `Downloading ${processedCount} of ${stopCount} stops.`
            : "Save stop audio on this device for offline replay."}
        </Text>
      </View>
      <ActionButton
        disabled={action.disabled}
        iconName={action.iconName}
        label={action.label}
        onPress={onDownloadAll}
      />
      {message ? <Text style={styles.downloadMessage}>{message}</Text> : null}
    </View>
  );
}

function TourProgressPanel({
  completedAt,
  isComplete,
  isResetting,
  onReset,
  playedCount,
  stopCount
}: {
  completedAt: string | null;
  isComplete: boolean;
  isResetting: boolean;
  onReset: () => void;
  playedCount: number;
  stopCount: number;
}) {
  const progressPercent =
    stopCount > 0 ? Math.min(100, (playedCount / stopCount) * 100) : 0;
  const hasProgress = playedCount > 0;

  return (
    <View style={styles.progressPanel}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.progressEyebrow}>Progress</Text>
          <Text style={styles.progressTitle}>
            {isComplete
              ? "Tour complete"
              : getProgressSummary({ playedCount, stopCount })}
          </Text>
        </View>
        {isComplete ? (
          <View style={styles.completeBadge}>
            <Ionicons color="#2d6a4f" name="checkmark-circle" size={16} />
            <Text style={styles.completeBadgeText}>Complete</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      <Text style={styles.progressBody}>
        {isComplete
          ? `Completed ${formatDisplayTimestamp(completedAt)}`
          : "Play stop audio to mark progress on this device."}
      </Text>
      {hasProgress ? (
        <ActionButton
          disabled={isResetting}
          iconName="refresh"
          label={isResetting ? "Resetting..." : "Reset progress"}
          onPress={onReset}
          variant="danger"
        />
      ) : null}
    </View>
  );
}

function SelectedStopPanel({
  audioStatus,
  downloadMessage,
  isPlayed,
  isDownloadingAudio,
  onDownloadAudio,
  stop
}: {
  audioStatus: AudioCacheStatus;
  downloadMessage: string | null;
  isPlayed: boolean;
  isDownloadingAudio: boolean;
  onDownloadAudio: () => void;
  stop: PublishedStop;
}) {
  const downloadAction = getAudioDownloadAction({
    audioStatus,
    isDownloading: isDownloadingAudio
  });

  return (
    <View style={styles.selectedPanel}>
      <View style={styles.selectedHeader}>
        <Text style={styles.selectedNumber}>Stop {stop.number}</Text>
        <View style={styles.selectedMetaGroup}>
          <Text style={styles.selectedPlayed}>
            {isPlayed ? "Played" : "Not played"}
          </Text>
          <Text style={styles.selectedAudioStatus}>
            {formatAudioStatusLabel(audioStatus)}
          </Text>
          <Text style={styles.selectedDuration}>
            {formatDuration(stop.audioDurationSeconds)}
          </Text>
        </View>
      </View>
      <Text style={styles.selectedTitle}>{stop.title}</Text>
      <Text style={styles.selectedSummary}>{stop.summary}</Text>
      <View style={styles.selectedAudioActions}>
        <ActionButton
          disabled={downloadAction.disabled}
          iconName={downloadAction.iconName}
          label={downloadAction.label}
          onPress={onDownloadAudio}
        />
        {downloadMessage ? (
          <Text style={styles.selectedDownloadMessage}>{downloadMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

function StopStatusPill({
  label,
  tone
}: {
  label: string;
  tone: "neutral" | "success";
}) {
  return (
    <View
      style={[
        styles.stopStatusPill,
        tone === "success" ? styles.stopStatusPillSuccess : null
      ]}
    >
      <Text
        style={[
          styles.stopStatusText,
          tone === "success" ? styles.stopStatusTextSuccess : null
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function formatAudioStatusLabel(status: AudioCacheStatus): string {
  if (status === "downloaded") {
    return "Audio saved";
  }

  if (status === "not-downloaded") {
    return "Not saved";
  }

  return "Streaming only";
}

function getDownloadAllAction({
  isAllSaved,
  isRunning,
  isUnavailable,
  stopCount
}: {
  isAllSaved: boolean;
  isRunning: boolean;
  isUnavailable: boolean;
  stopCount: number;
}): {
  disabled: boolean;
  iconName: "checkmark" | "cloud-download" | "cloud-offline" | "refresh";
  label: string;
} {
  if (isRunning) {
    return {
      disabled: true,
      iconName: "refresh",
      label: "Downloading all..."
    };
  }

  if (stopCount === 0 || isUnavailable) {
    return {
      disabled: true,
      iconName: "cloud-offline",
      label: "Download all unavailable"
    };
  }

  if (isAllSaved) {
    return {
      disabled: true,
      iconName: "checkmark",
      label: "All audio saved"
    };
  }

  return {
    disabled: false,
    iconName: "cloud-download",
    label: "Download all audio"
  };
}

function getAudioDownloadAction({
  audioStatus,
  isDownloading
}: {
  audioStatus: AudioCacheStatus;
  isDownloading: boolean;
}): {
  disabled: boolean;
  iconName: "checkmark" | "cloud-download" | "cloud-offline" | "refresh";
  label: string;
} {
  if (isDownloading) {
    return {
      disabled: true,
      iconName: "refresh",
      label: "Downloading..."
    };
  }

  if (audioStatus === "downloaded") {
    return {
      disabled: true,
      iconName: "checkmark",
      label: "Audio saved"
    };
  }

  if (audioStatus === "unavailable") {
    return {
      disabled: true,
      iconName: "cloud-offline",
      label: "Download unavailable"
    };
  }

  return {
    disabled: false,
    iconName: "cloud-download",
    label: "Download audio"
  };
}

function formatDownloadAllMessage({
  failedCount,
  savedCount,
  unavailableCount
}: {
  failedCount: number;
  savedCount: number;
  unavailableCount: number;
}): string {
  if (savedCount > 0 && failedCount === 0 && unavailableCount === 0) {
    return `Saved audio for ${savedCount} stop${savedCount === 1 ? "" : "s"}.`;
  }

  if (unavailableCount > 0 && savedCount === 0) {
    return "Audio downloads are not available on this device.";
  }

  if (failedCount > 0) {
    return `Saved ${savedCount} stop${savedCount === 1 ? "" : "s"}; ${failedCount} failed.`;
  }

  return `Saved ${savedCount} stop${savedCount === 1 ? "" : "s"}; ${unavailableCount} unavailable.`;
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
  progressPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d5ded8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 18,
    padding: 16
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  progressEyebrow: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  progressTitle: {
    color: "#16202a",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3
  },
  progressTrack: {
    backgroundColor: "#e7ece8",
    borderRadius: 999,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: "#2d6a4f",
    borderRadius: 999,
    height: 8
  },
  progressBody: {
    color: "#53615a",
    fontSize: 13,
    lineHeight: 19
  },
  completeBadge: {
    alignItems: "center",
    backgroundColor: "#eaf4f4",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 9
  },
  completeBadgeText: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800"
  },
  downloadPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d5ded8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    padding: 16
  },
  downloadCopy: {
    gap: 4
  },
  downloadEyebrow: {
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  downloadTitle: {
    color: "#16202a",
    fontSize: 18,
    fontWeight: "800"
  },
  downloadBody: {
    color: "#53615a",
    fontSize: 13,
    lineHeight: 19
  },
  downloadMessage: {
    color: "#53615a",
    fontSize: 13,
    lineHeight: 19
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
  selectedMetaGroup: {
    alignItems: "flex-end",
    gap: 3
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
  selectedPlayed: {
    color: "#a9d8c4",
    fontSize: 12,
    fontWeight: "800"
  },
  selectedAudioStatus: {
    color: "#dbe7df",
    fontSize: 12,
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
  selectedAudioActions: {
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4
  },
  selectedDownloadMessage: {
    color: "#dbe7df",
    fontSize: 13,
    lineHeight: 19
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
  stopRowPlayed: {
    backgroundColor: "#f5fbf7",
    borderColor: "#bfd8ca"
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
  stopNumberPlayed: {
    backgroundColor: "#2d6a4f"
  },
  stopText: {
    flex: 1,
    gap: 3
  },
  stopStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  stopTitle: {
    color: "#16202a",
    fontSize: 16,
    fontWeight: "800"
  },
  stopStatusPill: {
    backgroundColor: "#f1f3f0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  stopStatusPillSuccess: {
    backgroundColor: "#eaf4f4"
  },
  stopStatusText: {
    color: "#6d766f",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  stopStatusTextSuccess: {
    color: "#2d6a4f"
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
