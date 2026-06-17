import { Ionicons } from "@expo/vector-icons";
import type { PublishedStop } from "@wanderkit/shared";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus
} from "expo-audio";
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
import { StatePanel } from "../../../../components/StatePanel";
import { getCachedAudioUri, type CachedAudioResult } from "../../../../lib/audioCache";
import {
  loadPublishedTourManifest,
  normalizeTourCode,
  type TourLookupState
} from "../../../../lib/tourLookup";

export default function StopDetailScreen() {
  const router = useRouter();
  const { code, stopId } = useLocalSearchParams<{
    code: string;
    stopId: string;
  }>();
  const normalizedCode = normalizeTourCode(code);
  const selectedStopId = normalizeParam(stopId);
  const [lookupState, setLookupState] = useState<TourLookupState>({
    status: "loading"
  });

  useEffect(() => {
    let isMounted = true;

    async function loadManifest() {
      setLookupState({ status: "loading" });
      const nextState = await loadPublishedTourManifest(normalizedCode);

      if (isMounted) {
        setLookupState(nextState);
      }
    }

    void loadManifest();

    return () => {
      isMounted = false;
    };
  }, [normalizedCode]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color="#2d6a4f" name="chevron-back" size={18} />
          <Text style={styles.backText}>Route</Text>
        </Pressable>

        <StopDetailContent
          selectedStopId={selectedStopId}
          state={lookupState}
          tourCode={normalizedCode}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function StopDetailContent({
  selectedStopId,
  state,
  tourCode
}: {
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
        body="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to load published stops."
        code={tourCode}
        title="Supabase is not configured"
      />
    );
  }

  if (state.status === "not-found") {
    return (
      <StatePanel
        body="No published tour exists for this code."
        code={state.code}
        title="Tour not found"
      />
    );
  }

  if (state.status === "invalid") {
    return (
      <StatePanel
        body="This code returned JSON, but it does not match the published manifest contract."
        code={state.code}
        details={state.issues}
        title="Manifest is invalid"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel
        body={state.message}
        code={tourCode}
        title="Could not load stop"
      />
    );
  }

  const stop = state.manifest.stops.find(
    (manifestStop) => manifestStop.id === selectedStopId
  );

  if (!stop) {
    return (
      <StatePanel
        body="This stop is not present in the published manifest."
        code={tourCode}
        title="Stop not found"
      />
    );
  }

  return (
    <PlayableStop
      cacheReason={state.status === "cached" ? state.reason : null}
      manifestTitle={state.manifest.title}
      stop={stop}
      tourCode={state.manifest.tourCode}
    />
  );
}

function PlayableStop({
  cacheReason,
  manifestTitle,
  stop,
  tourCode
}: {
  cacheReason: "config-missing" | "network-error" | null;
  manifestTitle: string;
  stop: PublishedStop;
  tourCode: string;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.stopNumber}>Stop {stop.number}</Text>
        <Text style={styles.title}>{stop.title}</Text>
        <Text style={styles.subtitle}>{manifestTitle}</Text>
      </View>

      {cacheReason ? <CachedManifestBanner reason={cacheReason} /> : null}

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

      <AudioControls stop={stop} tourCode={tourCode} />

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

function CachedManifestBanner({
  reason
}: {
  reason: "config-missing" | "network-error";
}) {
  return (
    <View style={styles.cacheBanner}>
      <Text style={styles.cacheTitle}>Cached audio</Text>
      <Text style={styles.cacheBody}>
        {reason === "config-missing"
          ? "Supabase is not configured, so this stop is loaded from the saved tour."
          : "Network lookup failed, so this stop is loaded from the saved tour."}
      </Text>
    </View>
  );
}

function AudioControls({
  stop,
  tourCode
}: {
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
  cacheBanner: {
    backgroundColor: "#fff6df",
    borderColor: "#ead39b",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginTop: 18,
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
