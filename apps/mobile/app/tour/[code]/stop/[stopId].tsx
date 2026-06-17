import { Ionicons } from "@expo/vector-icons";
import type { PublishedStop, PublishedTourManifest } from "@wanderkit/shared";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus
} from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ActionButton } from "../../../../components/ActionButton";
import { CachedManifestNotice } from "../../../../components/CachedManifestNotice";
import { RetryButton } from "../../../../components/RetryButton";
import { StatePanel } from "../../../../components/StatePanel";
import { getCachedAudioUri, type CachedAudioResult } from "../../../../lib/audioCache";
import {
  createEmptyTourProgress,
  getProgressSummary,
  getTourProgressState,
  isStopPlayed,
  markTourStopPlayed,
  type TourProgressState
} from "../../../../lib/tourProgress";
import type { TourLookupState } from "../../../../lib/tourLookup";
import { useTourLookup } from "../../../../lib/useTourLookup";
import { saveVisitorResumeStop } from "../../../../lib/visitorResume";

export default function StopDetailScreen() {
  const router = useRouter();
  const { code, stopId } = useLocalSearchParams<{
    code: string;
    stopId: string;
  }>();
  const { lookupState, normalizedCode, retryLookup } = useTourLookup(code);
  const selectedStopId = normalizeParam(stopId);
  const openRoute = () => {
    router.replace(`/tour/${encodeURIComponent(normalizedCode)}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={openRoute} style={styles.backButton}>
          <Ionicons color="#2d6a4f" name="chevron-back" size={18} />
          <Text style={styles.backText}>Route</Text>
        </Pressable>

        <StopDetailContent
          onOpenRoute={openRoute}
          onRetry={() => void retryLookup()}
          selectedStopId={selectedStopId}
          state={lookupState}
          tourCode={normalizedCode}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function StopDetailContent({
  onOpenRoute,
  onRetry,
  selectedStopId,
  state,
  tourCode
}: {
  onOpenRoute: () => void;
  onRetry: () => void;
  selectedStopId: string;
  state: TourLookupState;
  tourCode: string;
}) {
  if (state.status === "loading") {
    return (
      <StatePanel
        action={<ActivityIndicator color="#2d6a4f" />}
        body={`Loading stop audio for ${tourCode}.`}
        title="Loading stop"
      />
    );
  }

  if (state.status === "config-missing") {
    return (
      <StatePanel
        action={<RetryButton onPress={onRetry} />}
        body="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to load published stops."
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
        title="Could not load stop"
        tone="danger"
      />
    );
  }

  const stop = state.manifest.stops.find(
    (manifestStop) => manifestStop.id === selectedStopId
  );

  if (!stop) {
    return (
      <StatePanel
        action={
          <ActionButton
            iconName="map"
            label="Open route"
            onPress={onOpenRoute}
          />
        }
        body="This stop is not present in the published manifest."
        code={tourCode}
        title="Stop not found"
        tone="warning"
      />
    );
  }

  return (
    <PlayableStop
      cacheMetadata={
        state.status === "cached"
          ? { cachedAt: state.cachedAt, reason: state.reason }
          : null
      }
      manifest={state.manifest}
      stop={stop}
    />
  );
}

function PlayableStop({
  cacheMetadata,
  manifest,
  stop
}: {
  cacheMetadata: {
    cachedAt: string | null;
    reason: "config-missing" | "network-error";
  } | null;
  manifest: PublishedTourManifest;
  stop: PublishedStop;
}) {
  const [progress, setProgress] = useState<TourProgressState>(() =>
    createEmptyTourProgress(manifest.tourCode)
  );
  const playedCount = manifest.stops.filter((manifestStop) =>
    isStopPlayed(progress, manifestStop.id)
  ).length;
  const isCurrentStopPlayed = isStopPlayed(progress, stop.id);
  const isTourComplete =
    manifest.stops.length > 0 && playedCount === manifest.stops.length;

  useEffect(() => {
    saveVisitorResumeStop({ manifest, stop }).catch(() => {
      // Resume state should not block playing a valid stop.
    });
  }, [manifest, stop]);

  useEffect(() => {
    let isMounted = true;

    getTourProgressState(manifest.tourCode)
      .then((nextProgress) => {
        if (isMounted) {
          setProgress(nextProgress);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProgress(createEmptyTourProgress(manifest.tourCode));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [manifest.tourCode]);

  const markCurrentStopPlayed = async () => {
    const nextProgress = await markTourStopPlayed({
      stopId: stop.id,
      stopIds: manifest.stops.map((manifestStop) => manifestStop.id),
      tourCode: manifest.tourCode
    });
    setProgress(nextProgress);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.stopNumber}>Stop {stop.number}</Text>
        <Text style={styles.title}>{stop.title}</Text>
        <Text style={styles.subtitle}>{manifest.title}</Text>
      </View>

      {cacheMetadata ? (
        <CachedManifestNotice
          cachedAt={cacheMetadata.cachedAt}
          contentHash={manifest.contentHash}
          publishedAt={manifest.publishedAt}
          reason={cacheMetadata.reason}
          title="Saved stop details"
        />
      ) : null}

      <View style={styles.coordinatePanel}>
        <View>
          <Text style={styles.metaLabel}>Latitude</Text>
          <Text style={styles.metaValue}>
            {stop.coordinate.latitude.toFixed(5)}
          </Text>
        </View>
        <View>
          <Text style={styles.metaLabel}>Longitude</Text>
          <Text style={styles.metaValue}>
            {stop.coordinate.longitude.toFixed(5)}
          </Text>
        </View>
      </View>

      <StopProgressCard
        isComplete={isTourComplete}
        isPlayed={isCurrentStopPlayed}
        playedCount={playedCount}
        stopCount={manifest.stops.length}
      />

      <AudioControls
        onMarkPlayed={() => {
          markCurrentStopPlayed().catch(() => {
            // Local progress writes should not block audio playback.
          });
        }}
        stop={stop}
        tourCode={manifest.tourCode}
      />

      <View style={styles.notesPanel}>
        <Text style={styles.notesTitle}>About this stop</Text>
        <Text style={styles.notesBody}>{stop.summary}</Text>
        {stop.transcript ? (
          <Text style={styles.transcript}>{stop.transcript}</Text>
        ) : null}
      </View>
    </>
  );
}

function AudioControls({
  onMarkPlayed,
  stop,
  tourCode
}: {
  onMarkPlayed: () => void;
  stop: PublishedStop;
  tourCode: string;
}) {
  const [audioSource, setAudioSource] = useState<CachedAudioResult>({
    source: "remote",
    uri: stop.audioUrl,
    message: "Preparing audio."
  });
  const player = useAudioPlayer({ uri: audioSource.uri }, 250);
  const status = useAudioPlayerStatus(player);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false
    }).catch((error: unknown) => {
      setAudioError(
        error instanceof Error
          ? error.message
          : "Audio mode could not be configured."
      );
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    setAudioError(null);
    setAudioSource({
      source: "remote",
      uri: stop.audioUrl,
      message: "Preparing audio."
    });

    getCachedAudioUri({
      audioUrl: stop.audioUrl,
      stopId: stop.id,
      tourCode
    })
      .then((result) => {
        if (isMounted) {
          setAudioSource(result);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAudioSource({
            source: "remote",
            uri: stop.audioUrl,
            message:
              error instanceof Error
                ? error.message
                : "Audio cache could not be prepared."
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [stop.audioUrl, stop.id, tourCode]);

  const duration = status.duration || stop.audioDurationSeconds || 0;
  const currentTime = Math.min(status.currentTime || 0, duration || 0);
  const progress = duration > 0 ? currentTime / duration : 0;
  const playLabel = status.playing ? "Pause" : "Play";

  const playOrPause = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }

      if (status.didJustFinish || isAtEnd(currentTime, duration)) {
        await player.seekTo(0);
      }

      player.play();
      onMarkPlayed();
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Audio could not be played."
      );
    }
  };

  const seekBy = async (seconds: number) => {
    try {
      const nextTime = clamp(currentTime + seconds, 0, duration || currentTime);
      await player.seekTo(nextTime);
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Audio could not seek."
      );
    }
  };

  const replay = async () => {
    try {
      await player.seekTo(0);
      player.play();
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Audio could not restart."
      );
    }
  };

  return (
    <View style={styles.audioPanel}>
      <View style={styles.audioHeader}>
        <Text style={styles.audioTitle}>Audio</Text>
        <Text style={styles.audioTime}>
          {formatClock(currentTime)} / {formatClock(duration)}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.audioControls}>
        <Pressable
          accessibilityLabel="Back 15 seconds"
          onPress={() => void seekBy(-15)}
          style={styles.secondaryControl}
        >
          <Ionicons color="#16202a" name="play-back" size={20} />
          <Text style={styles.secondaryControlText}>15</Text>
        </Pressable>

        <Pressable onPress={() => void playOrPause()} style={styles.playControl}>
          <Ionicons
            color="#ffffff"
            name={status.playing ? "pause" : "play"}
            size={22}
          />
          <Text style={styles.playControlText}>{playLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Forward 15 seconds"
          onPress={() => void seekBy(15)}
          style={styles.secondaryControl}
        >
          <Text style={styles.secondaryControlText}>15</Text>
          <Ionicons color="#16202a" name="play-forward" size={20} />
        </Pressable>
      </View>

      <Pressable onPress={() => void replay()} style={styles.replayButton}>
        <Ionicons color="#2d6a4f" name="refresh" size={18} />
        <Text style={styles.replayText}>Replay from start</Text>
      </Pressable>

      {status.isBuffering ? (
        <Text style={styles.audioHint}>Buffering audio...</Text>
      ) : null}
      <Text style={styles.audioHint}>{formatAudioSource(audioSource)}</Text>
      {audioError ? <Text style={styles.audioError}>{audioError}</Text> : null}
    </View>
  );
}

function StopProgressCard({
  isComplete,
  isPlayed,
  playedCount,
  stopCount
}: {
  isComplete: boolean;
  isPlayed: boolean;
  playedCount: number;
  stopCount: number;
}) {
  return (
    <View style={styles.stopProgressCard}>
      <View
        style={[
          styles.stopProgressIcon,
          isPlayed ? styles.stopProgressIconPlayed : null
        ]}
      >
        <Ionicons
          color={isPlayed ? "#ffffff" : "#2d6a4f"}
          name={isPlayed ? "checkmark" : "play"}
          size={16}
        />
      </View>
      <View style={styles.stopProgressCopy}>
        <Text style={styles.stopProgressTitle}>
          {isComplete ? "Tour complete" : isPlayed ? "Stop played" : "Not played yet"}
        </Text>
        <Text style={styles.stopProgressBody}>
          {getProgressSummary({ playedCount, stopCount })}
        </Text>
      </View>
    </View>
  );
}

function formatAudioSource(source: CachedAudioResult): string {
  if (source.source === "cache") {
    return "Playing downloaded audio.";
  }

  if (source.source === "download") {
    return "Audio downloaded for offline replay.";
  }

  return source.message === "Preparing audio."
    ? source.message
    : `Streaming audio. ${source.message}`;
}

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isAtEnd(currentTime: number, duration: number): boolean {
  return duration > 0 && currentTime >= duration - 0.25;
}

function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    minHeight: 40,
    paddingRight: 12
  },
  backText: {
    color: "#2d6a4f",
    fontSize: 15,
    fontWeight: "800"
  },
  header: {
    gap: 8,
    paddingTop: 18
  },
  stopNumber: {
    alignSelf: "flex-start",
    backgroundColor: "#eaf4f4",
    borderRadius: 6,
    color: "#2d6a4f",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase"
  },
  title: {
    color: "#16202a",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0
  },
  subtitle: {
    color: "#53615a",
    fontSize: 16,
    lineHeight: 23
  },
  coordinatePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e6e2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    padding: 16
  },
  stopProgressCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d5ded8",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14
  },
  stopProgressIcon: {
    alignItems: "center",
    backgroundColor: "#eaf4f4",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  stopProgressIconPlayed: {
    backgroundColor: "#2d6a4f"
  },
  stopProgressCopy: {
    flex: 1,
    gap: 2
  },
  stopProgressTitle: {
    color: "#16202a",
    fontSize: 15,
    fontWeight: "800"
  },
  stopProgressBody: {
    color: "#53615a",
    fontSize: 13,
    lineHeight: 19
  },
  metaLabel: {
    color: "#53615a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  metaValue: {
    color: "#16202a",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4
  },
  audioPanel: {
    backgroundColor: "#16202a",
    borderRadius: 8,
    gap: 16,
    marginTop: 18,
    padding: 18
  },
  audioHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  audioTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800"
  },
  audioTime: {
    color: "#dbe7df",
    fontSize: 14,
    fontWeight: "700"
  },
  progressTrack: {
    backgroundColor: "#33414b",
    borderRadius: 999,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: "#a9d8c4",
    borderRadius: 999,
    height: 8
  },
  audioControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  secondaryControl: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 74
  },
  secondaryControlText: {
    color: "#16202a",
    fontSize: 14,
    fontWeight: "800"
  },
  playControl: {
    alignItems: "center",
    backgroundColor: "#c8553d",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52
  },
  playControlText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  replayButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10
  },
  replayText: {
    color: "#a9d8c4",
    fontSize: 14,
    fontWeight: "800"
  },
  audioHint: {
    color: "#dbe7df",
    fontSize: 14,
    lineHeight: 20
  },
  audioError: {
    color: "#ffd6cc",
    fontSize: 14,
    lineHeight: 20
  },
  notesPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e6e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
    padding: 18
  },
  notesTitle: {
    color: "#16202a",
    fontSize: 18,
    fontWeight: "800"
  },
  notesBody: {
    color: "#53615a",
    fontSize: 16,
    lineHeight: 24
  },
  transcript: {
    color: "#16202a",
    fontSize: 15,
    lineHeight: 23
  }
});
