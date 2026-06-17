"use client";

import {
  buildPublishedTourManifestFromDraft,
  StudioDraftTourSchema,
  type PublishedTourManifest,
  type StudioDraftTour
} from "@wanderkit/shared";
import { useEffect, useMemo, useState } from "react";

type DraftStopForm = {
  audioCredit: string;
  audioDurationSeconds: string;
  audioFileName: string;
  audioLicense: string;
  audioMimeType: string;
  audioStoragePath: string;
  audioUrl: string;
  id: string;
  latitude: string;
  longitude: string;
  summary: string;
  title: string;
  transcript: string;
};

type RoutePointForm = {
  id: string;
  latitude: string;
  longitude: string;
};

type DraftForm = {
  city: string;
  countryCode: string;
  description: string;
  id: string;
  locale: string;
  route: RoutePointForm[];
  stops: DraftStopForm[];
  title: string;
  tourCode: string;
};

type DraftTextField = Exclude<keyof DraftForm, "route" | "stops">;

type ApiStatus = {
  tone: "idle" | "success" | "warning" | "error";
  message: string;
};

type DraftSummary = {
  city: string;
  id: string;
  status: "draft" | "published" | "archived";
  stopCount: number;
  title: string;
  tourCode: string;
  updatedAt: string;
};

type PublishHistoryItem = {
  contentHash: string;
  id: string;
  publishedAt: string;
  publishVersion: number;
  tourCode: string;
};

const DEMO_AUDIO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

export function StudioEditor() {
  const [form, setForm] = useState<DraftForm>(() => createInitialDraftForm());
  const [draftSummaries, setDraftSummaries] = useState<DraftSummary[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>(
    []
  );
  const [audioUploadStatuses, setAudioUploadStatuses] = useState<
    Record<string, ApiStatus>
  >({});
  const [uploadingStopIds, setUploadingStopIds] = useState<
    Record<string, boolean>
  >({});
  const [listStatus, setListStatus] = useState<ApiStatus>({
    tone: "idle",
    message: ""
  });
  const [historyStatus, setHistoryStatus] = useState<ApiStatus>({
    tone: "idle",
    message: ""
  });
  const [saveStatus, setSaveStatus] = useState<ApiStatus>({
    tone: "idle",
    message: ""
  });
  const [publishStatus, setPublishStatus] = useState<ApiStatus>({
    tone: "idle",
    message: ""
  });
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const draftResult = useMemo(() => buildDraft(form), [form]);
  const manifestResult = useMemo(
    () => buildPreviewManifest(draftResult.draft),
    [draftResult.draft]
  );

  useEffect(() => {
    void refreshDraftList();
  }, []);

  const refreshDraftList = async () => {
    setIsLoadingDrafts(true);

    try {
      const response = await getJson<DraftListResponse>("/api/studio/drafts");
      setDraftSummaries(response.drafts ?? []);
      setListStatus({
        tone: response.status === "local-only" ? "warning" : "success",
        message: response.message ?? "Drafts loaded."
      });
    } catch (error) {
      setListStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Drafts could not be loaded."
      });
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const refreshPublishHistory = async (tourId: string) => {
    setIsLoadingHistory(true);

    try {
      const response = await getJson<PublishHistoryResponse>(
        `/api/studio/drafts/${encodeURIComponent(tourId)}/publishes`
      );
      setPublishHistory(response.history ?? []);
      setHistoryStatus({
        tone: response.status === "local-only" ? "warning" : "success",
        message: response.message ?? "Publish history loaded."
      });
    } catch (error) {
      setPublishHistory([]);
      setHistoryStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Publish history could not be loaded."
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadDraft = async (tourId: string) => {
    setIsLoadingDraft(true);
    setSaveStatus({ tone: "idle", message: "" });
    setPublishStatus({ tone: "idle", message: "" });
    setHistoryStatus({ tone: "idle", message: "" });

    try {
      const response = await getJson<DraftLoadResponse>(
        `/api/studio/drafts/${encodeURIComponent(tourId)}`
      );

      if (!response.draft) {
        setPublishHistory([]);
        setListStatus({
          tone: response.status === "local-only" ? "warning" : "error",
          message: response.message ?? "Draft could not be loaded."
        });
        return;
      }

      setForm(createDraftFormFromDraft(response.draft));
      setAudioUploadStatuses({});
      setUploadingStopIds({});
      void refreshPublishHistory(response.draft.id);
      setListStatus({
        tone: "success",
        message: response.message ?? "Draft loaded."
      });
    } catch (error) {
      setListStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Draft could not be loaded."
      });
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const newDraft = () => {
    setForm(createInitialDraftForm());
    setPublishHistory([]);
    setAudioUploadStatuses({});
    setUploadingStopIds({});
    setHistoryStatus({ tone: "idle", message: "" });
    setSaveStatus({ tone: "idle", message: "" });
    setPublishStatus({ tone: "idle", message: "" });
  };

  const updateField = (field: DraftTextField, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === "tourCode" ? normalizeTourCodeInput(value) : value
    }));
  };

  const updateStop = (
    stopId: string,
    field: keyof DraftStopForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop) =>
        stop.id === stopId ? { ...stop, [field]: value } : stop
      )
    }));
  };

  const addStop = () => {
    setForm((current) => ({
      ...current,
      stops: [
        ...current.stops,
        createStopForm({
          title: `Stop ${current.stops.length + 1}`,
          latitude: current.stops.at(-1)?.latitude ?? "48.4301",
          longitude: current.stops.at(-1)?.longitude ?? "-123.3652"
        })
      ]
    }));
  };

  const removeStop = (stopId: string) => {
    setForm((current) => ({
      ...current,
      stops:
        current.stops.length <= 2
          ? current.stops
          : current.stops.filter((stop) => stop.id !== stopId)
    }));
    setAudioUploadStatuses((current) => omitKey(current, stopId));
    setUploadingStopIds((current) => omitKey(current, stopId));
  };

  const uploadStopAudio = async (stopId: string, file: File | null) => {
    if (!file) {
      return;
    }

    setUploadingStopIds((current) => ({ ...current, [stopId]: true }));
    setAudioUploadStatuses((current) => ({
      ...current,
      [stopId]: {
        tone: "idle",
        message: `Reading ${file.name}...`
      }
    }));

    try {
      const durationSeconds = await getAudioDurationSeconds(file);

      setForm((current) => ({
        ...current,
        stops: current.stops.map((stop) =>
          stop.id === stopId
            ? {
                ...stop,
                audioDurationSeconds: String(durationSeconds),
                audioFileName: file.name,
                audioMimeType: file.type
              }
            : stop
        )
      }));
      setAudioUploadStatuses((current) => ({
        ...current,
        [stopId]: {
          tone: "idle",
          message: `Detected ${formatDurationSeconds(durationSeconds)}. Uploading...`
        }
      }));

      const body = new FormData();
      body.append("tourId", form.id);
      body.append("stopId", stopId);
      body.append("file", file);

      const response = await fetch("/api/studio/audio", {
        body,
        method: "POST"
      });
      const data = (await response.json()) as AudioUploadResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Audio could not be uploaded.");
      }

      if (data.status === "uploaded") {
        setForm((current) => ({
          ...current,
          stops: current.stops.map((stop) =>
            stop.id === stopId
              ? {
                  ...stop,
                  audioUrl: data.audioUrl,
                  audioDurationSeconds: String(durationSeconds),
                  audioStoragePath: data.audioStoragePath,
                  audioFileName: data.audioFileName,
                  audioMimeType: data.audioMimeType
                }
              : stop
          )
        }));
      }

      setAudioUploadStatuses((current) => ({
        ...current,
        [stopId]: {
          tone: data.status === "uploaded" ? "success" : "warning",
          message: data.message ?? "Audio upload finished."
        }
      }));
    } catch (error) {
      setAudioUploadStatuses((current) => ({
        ...current,
        [stopId]: {
          tone: "error",
          message:
            error instanceof Error ? error.message : "Audio could not be uploaded."
        }
      }));
    } finally {
      setUploadingStopIds((current) => omitKey(current, stopId));
    }
  };

  const updateRoutePoint = (
    pointId: string,
    field: "latitude" | "longitude",
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      route: current.route.map((point) =>
        point.id === pointId ? { ...point, [field]: value } : point
      )
    }));
  };

  const addRoutePoint = () => {
    setForm((current) => {
      const lastPoint = current.route.at(-1);
      const lastStop = current.stops.at(-1);

      return {
        ...current,
        route: [
          ...current.route,
          createRoutePointForm({
            latitude: lastPoint?.latitude ?? lastStop?.latitude ?? "48.4301",
            longitude: lastPoint?.longitude ?? lastStop?.longitude ?? "-123.3652"
          })
        ]
      };
    });
  };

  const removeRoutePoint = (pointId: string) => {
    setForm((current) => ({
      ...current,
      route:
        current.route.length <= 2
          ? current.route
          : current.route.filter((point) => point.id !== pointId)
    }));
  };

  const resetRouteFromStops = () => {
    setForm((current) => ({
      ...current,
      route: current.stops.map((stop) =>
        createRoutePointForm({
          latitude: stop.latitude,
          longitude: stop.longitude
        })
      )
    }));
  };

  const saveDraft = async () => {
    if (!draftResult.draft) {
      setSaveStatus({
        tone: "error",
        message: draftResult.errors[0] ?? "Draft is not valid."
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ tone: "idle", message: "" });

    try {
      const response = await postJson("/api/studio/drafts", draftResult.draft);
      setSaveStatus({
        tone: response.status === "local-only" ? "warning" : "success",
        message: response.message
      });
      void refreshDraftList();
    } catch (error) {
      setSaveStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Draft could not be saved."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const publishDraft = async () => {
    const draft = draftResult.draft;

    if (!draft || !manifestResult.manifest) {
      setPublishStatus({
        tone: "error",
        message:
          manifestResult.errors[0] ??
          draftResult.errors[0] ??
          "Manifest is not valid."
      });
      return;
    }

    setIsPublishing(true);
    setPublishStatus({ tone: "idle", message: "" });

    try {
      const response = await postJson("/api/studio/publish", draft);
      setPublishStatus({
        tone: response.status === "validated" ? "warning" : "success",
        message: response.message
      });
      void refreshDraftList();
      void refreshPublishHistory(draft.id);
    } catch (error) {
      setPublishStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Manifest could not be published."
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const validationErrors = [
    ...draftResult.errors,
    ...(draftResult.draft ? manifestResult.errors : [])
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
      <div className="space-y-6">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-clay">Saved drafts</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Continue a tour
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
                onClick={() => void refreshDraftList()}
                type="button"
              >
                {isLoadingDrafts ? "Refreshing..." : "Refresh"}
              </button>
              <button
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss"
                onClick={newDraft}
                type="button"
              >
                New draft
              </button>
            </div>
          </div>

          {draftSummaries.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {draftSummaries.map((draft) => (
                <button
                  className={`rounded-lg border p-4 text-left transition hover:border-moss ${
                    draft.id === form.id
                      ? "border-moss bg-skywash"
                      : "border-ink/10 bg-paper"
                  }`}
                  disabled={isLoadingDraft}
                  key={draft.id}
                  onClick={() => void loadDraft(draft.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{draft.title}</p>
                      <p className="mt-1 text-sm text-ink/60">
                        {draft.city} - {draft.stopCount} stops
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
                      {draft.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-moss">
                      {draft.tourCode || "No code"}
                    </span>
                    <span className="text-ink/50">
                      {formatDate(draft.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-ink/10 bg-paper p-4">
              <p className="font-semibold text-ink">No saved drafts loaded.</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Create a new draft now, or configure Supabase server env vars to
                load existing tours.
              </p>
            </div>
          )}

          <StatusMessage status={listStatus} />
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-clay">Draft tour</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">
                {form.title || "Untitled tour"}
              </h2>
            </div>
            <div className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              {form.tourCode || "CODE"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TextField
              label="Title"
              onChange={(value) => updateField("title", value)}
              value={form.title}
            />
            <TextField
              label="Tour code"
              maxLength={16}
              onChange={(value) => updateField("tourCode", value)}
              value={form.tourCode}
            />
            <TextField
              label="City"
              onChange={(value) => updateField("city", value)}
              value={form.city}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Country"
                maxLength={2}
                onChange={(value) => updateField("countryCode", value)}
                value={form.countryCode}
              />
              <TextField
                label="Locale"
                onChange={(value) => updateField("locale", value)}
                value={form.locale}
              />
            </div>
            <label className="lg:col-span-2">
              <span className="text-sm font-semibold text-ink">Description</span>
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-moss focus:bg-white"
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                value={form.description}
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-clay">Route line</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Polyline coordinates
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
                onClick={resetRouteFromStops}
                type="button"
              >
                Reset from stops
              </button>
              <button
                className="rounded-md border border-moss/30 bg-skywash px-4 py-2 text-sm font-semibold text-moss transition hover:border-moss"
                onClick={addRoutePoint}
                type="button"
              >
                Add point
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {form.route.map((point, index) => (
              <div
                className="grid gap-3 rounded-lg border border-ink/10 bg-paper p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                key={point.id}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <TextField
                  label="Latitude"
                  onChange={(value) =>
                    updateRoutePoint(point.id, "latitude", value)
                  }
                  value={point.latitude}
                />
                <TextField
                  label="Longitude"
                  onChange={(value) =>
                    updateRoutePoint(point.id, "longitude", value)
                  }
                  value={point.longitude}
                />
                <button
                  className="h-10 rounded-md px-3 text-sm font-semibold text-ink/60 transition hover:bg-white hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={form.route.length <= 2}
                  onClick={() => removeRoutePoint(point.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-clay">Stops</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Numbered audio stops
              </h2>
            </div>
            <button
              className="rounded-md border border-moss/30 bg-skywash px-4 py-2 text-sm font-semibold text-moss transition hover:border-moss"
              onClick={addStop}
              type="button"
            >
              Add stop
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {form.stops.map((stop, index) => (
              <div
                className="rounded-lg border border-ink/10 bg-paper p-4"
                key={stop.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-ink">
                        {stop.title || `Stop ${index + 1}`}
                      </p>
                      <p className="text-sm text-ink/60">
                        {stop.latitude}, {stop.longitude}
                      </p>
                    </div>
                  </div>
                  <button
                    className="rounded-md px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-white hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={form.stops.length <= 2}
                    onClick={() => removeStop(stop.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <TextField
                    label="Stop title"
                    onChange={(value) => updateStop(stop.id, "title", value)}
                    value={stop.title}
                  />
                  <TextField
                    label="Audio URL"
                    onChange={(value) => updateStop(stop.id, "audioUrl", value)}
                    value={stop.audioUrl}
                  />
                  <div className="rounded-md border border-ink/10 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          Audio upload
                        </p>
                        <p className="mt-1 text-xs leading-5 text-ink/60">
                          MP3, M4A, AAC, OGG, WAV, or WebM. Max 50 MB.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-moss/30 bg-skywash px-3 py-2 text-sm font-semibold text-moss transition hover:border-moss has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
                        {uploadingStopIds[stop.id]
                          ? "Uploading..."
                          : "Choose file"}
                        <input
                          accept="audio/aac,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/x-m4a"
                          className="sr-only"
                          disabled={Boolean(uploadingStopIds[stop.id])}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            event.currentTarget.value = "";
                            void uploadStopAudio(stop.id, file);
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                    <StatusMessage
                      status={
                        audioUploadStatuses[stop.id] ?? {
                          tone: "idle",
                          message: ""
                        }
                      }
                    />
                  </div>
                  <TextField
                    label="Audio file name"
                    onChange={(value) =>
                      updateStop(stop.id, "audioFileName", value)
                    }
                    value={stop.audioFileName}
                  />
                  <TextField
                    label="Storage path"
                    onChange={(value) =>
                      updateStop(stop.id, "audioStoragePath", value)
                    }
                    value={stop.audioStoragePath}
                  />
                  <TextField
                    label="MIME type"
                    onChange={(value) =>
                      updateStop(stop.id, "audioMimeType", value)
                    }
                    value={stop.audioMimeType}
                  />
                  <TextField
                    label="Latitude"
                    onChange={(value) => updateStop(stop.id, "latitude", value)}
                    value={stop.latitude}
                  />
                  <TextField
                    label="Longitude"
                    onChange={(value) => updateStop(stop.id, "longitude", value)}
                    value={stop.longitude}
                  />
                  <TextField
                    label="Duration seconds"
                    onChange={(value) =>
                      updateStop(stop.id, "audioDurationSeconds", value)
                    }
                    value={stop.audioDurationSeconds}
                  />
                  <TextField
                    label="Audio credit"
                    onChange={(value) =>
                      updateStop(stop.id, "audioCredit", value)
                    }
                    value={stop.audioCredit}
                  />
                  <TextField
                    label="Audio license"
                    onChange={(value) =>
                      updateStop(stop.id, "audioLicense", value)
                    }
                    value={stop.audioLicense}
                  />
                  <TextField
                    label="Summary"
                    onChange={(value) => updateStop(stop.id, "summary", value)}
                    value={stop.summary}
                  />
                  <label className="lg:col-span-2">
                    <span className="text-sm font-semibold text-ink">
                      Transcript
                    </span>
                    <textarea
                      className="mt-2 min-h-20 w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-moss"
                      onChange={(event) =>
                        updateStop(stop.id, "transcript", event.target.value)
                      }
                      value={stop.transcript}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-clay">Publish check</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Manifest preview
              </h2>
            </div>
            <span className="rounded-md bg-moss/10 px-2.5 py-1 text-xs font-semibold text-moss">
              schema v1
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Metric label="Stops" value={String(form.stops.length)} />
            <Metric
              label="Route points"
              value={String(manifestResult.manifest?.route.length ?? 0)}
            />
            <Metric
              label="Audio"
              value={
                draftResult.draft
                  ? `${Math.round(
                      draftResult.draft.stops.reduce(
                        (total, stop) =>
                          total + (stop.audioDurationSeconds ?? 0),
                        0
                      ) / 60
                    )} min`
                  : "0 min"
              }
            />
          </div>

          {validationErrors.length > 0 ? (
            <div className="mt-5 space-y-2">
              {validationErrors.slice(0, 5).map((error) => (
                <p
                  className="rounded-md bg-clay/10 px-3 py-2 text-sm leading-5 text-clay"
                  key={error}
                >
                  {error}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-moss/10 px-3 py-2 text-sm font-medium text-moss">
              Draft can be published.
            </p>
          )}

          <pre className="mt-5 max-h-[32rem] overflow-auto rounded-md bg-ink p-4 text-xs leading-5 text-skywash">
            {JSON.stringify(manifestResult.manifest ?? draftResult.raw, null, 2)}
          </pre>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-clay">Publish history</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Frozen versions
              </h2>
            </div>
            <button
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss disabled:cursor-wait disabled:opacity-60"
              disabled={isLoadingHistory}
              onClick={() => void refreshPublishHistory(form.id)}
              type="button"
            >
              {isLoadingHistory ? "Loading..." : "Refresh"}
            </button>
          </div>

          {publishHistory.length > 0 ? (
            <div className="mt-5 space-y-3">
              {publishHistory.map((publish) => (
                <div
                  className="rounded-lg border border-ink/10 bg-paper p-4"
                  key={publish.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        Version {publish.publishVersion}
                      </p>
                      <p className="mt-1 text-sm text-ink/60">
                        {formatDateTime(publish.publishedAt)}
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-moss">
                      {publish.tourCode}
                    </span>
                  </div>
                  <p className="mt-3 break-all rounded-md bg-white px-3 py-2 font-mono text-xs leading-5 text-ink/60">
                    {publish.contentHash}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-ink/10 bg-paper p-4">
              <p className="font-semibold text-ink">No published versions.</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Publish this draft to create version 1.
              </p>
            </div>
          )}

          <StatusMessage status={historyStatus} />
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <button
              className="rounded-md border border-ink/15 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss disabled:cursor-wait disabled:opacity-60"
              disabled={isSaving}
              onClick={() => void saveDraft()}
              type="button"
            >
              {isSaving ? "Saving..." : "Save draft"}
            </button>
            <button
              className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-wait disabled:opacity-60"
              disabled={isPublishing}
              onClick={() => void publishDraft()}
              type="button"
            >
              {isPublishing ? "Publishing..." : "Publish manifest"}
            </button>
          </div>

          <StatusMessage status={saveStatus} />
          <StatusMessage status={publishStatus} />
        </section>
      </aside>
    </section>
  );
}

function TextField({
  label,
  maxLength,
  onChange,
  value
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        className="mt-2 h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-moss"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function StatusMessage({ status }: { status: ApiStatus }) {
  if (!status.message) {
    return null;
  }

  const classes = {
    error: "bg-clay/10 text-clay",
    idle: "bg-ink/5 text-ink/70",
    success: "bg-moss/10 text-moss",
    warning: "bg-skywash text-moss"
  };

  return (
    <p className={`mt-3 rounded-md px-3 py-2 text-sm ${classes[status.tone]}`}>
      {status.message}
    </p>
  );
}

async function postJson(path: string, body: StudioDraftTour) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = (await response.json()) as { message?: string; status?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed.");
  }

  return {
    message: data.message ?? "Done.",
    status: data.status ?? "success"
  };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const data = (await response.json()) as T & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed.");
  }

  return data;
}

type DraftListResponse = {
  drafts?: DraftSummary[];
  message?: string;
  status?: string;
};

type DraftLoadResponse = {
  draft?: StudioDraftTour;
  message?: string;
  status?: string;
};

type PublishHistoryResponse = {
  history?: PublishHistoryItem[];
  message?: string;
  status?: string;
};

type AudioUploadResponse =
  | {
      message: string;
      status: "local-only";
    }
  | {
      audioFileName: string;
      audioMimeType: string;
      audioSizeBytes: number;
      audioStoragePath: string;
      audioUrl: string;
      message: string;
      status: "uploaded";
    }
  | {
      message?: string;
      status?: "error";
    };

function createInitialDraftForm(): DraftForm {
  const stops = [
    createStopForm({
      title: "Steamship Terminal",
      summary: "Begin beside the old gateway for coastal arrivals.",
      latitude: "48.42160",
      longitude: "-123.37060",
      duration: "132",
      transcript:
        "The terminal framed the harbor as an arrival point long before visitors carried phones with maps."
    }),
    createStopForm({
      title: "Causeway Railings",
      summary: "Pause where the harbor opens into a wide public room.",
      latitude: "48.42290",
      longitude: "-123.36930",
      duration: "118",
      transcript:
        "This stretch works like a balcony over the water, with layers of transport, tourism, and ceremony."
    }),
    createStopForm({
      title: "Customs House",
      summary: "End near the administrative edge of the old port.",
      latitude: "48.42420",
      longitude: "-123.36820",
      duration: "146",
      transcript:
        "The route closes where documents, trade, and public architecture met the working waterfront."
    })
  ];

  return {
    id: createId(),
    title: "Harbor History Walk",
    description:
      "A compact waterfront route with three narrated stops and an easy loop back to the start.",
    city: "Victoria",
    countryCode: "CA",
    locale: "en",
    tourCode: "HARBOR1",
    route: stops.map((stop) =>
      createRoutePointForm({
        latitude: stop.latitude,
        longitude: stop.longitude
      })
    ),
    stops
  };
}

function createStopForm({
  audioCredit = "",
  audioFileName = "demo-stop.mp3",
  audioLicense = "",
  audioMimeType = "audio/mpeg",
  audioStoragePath = "",
  duration = "120",
  latitude,
  longitude,
  summary = "",
  title,
  transcript = ""
}: {
  duration?: string;
  latitude: string;
  longitude: string;
  summary?: string;
  title: string;
  transcript?: string;
  audioCredit?: string;
  audioFileName?: string;
  audioLicense?: string;
  audioMimeType?: string;
  audioStoragePath?: string;
}): DraftStopForm {
  return {
    id: createId(),
    title,
    summary,
    latitude,
    longitude,
    audioUrl: DEMO_AUDIO_URL,
    audioStoragePath,
    audioFileName,
    audioMimeType,
    audioCredit,
    audioLicense,
    audioDurationSeconds: duration,
    transcript
  };
}

function createRoutePointForm({
  latitude,
  longitude
}: {
  latitude: string;
  longitude: string;
}): RoutePointForm {
  return {
    id: createId(),
    latitude,
    longitude
  };
}

function createDraftFormFromDraft(draft: StudioDraftTour): DraftForm {
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    city: draft.city,
    countryCode: draft.countryCode ?? "",
    locale: draft.locale,
    tourCode: draft.tourCode,
    route: draft.route.map((point) =>
      createRoutePointForm({
        latitude: String(point.latitude),
        longitude: String(point.longitude)
      })
    ),
    stops: draft.stops.map((stop) => ({
      id: stop.id,
      title: stop.title,
      summary: stop.summary ?? "",
      latitude: String(stop.coordinate.latitude),
      longitude: String(stop.coordinate.longitude),
      audioUrl: stop.audioUrl,
      audioStoragePath: stop.audioStoragePath ?? "",
      audioFileName: stop.audioFileName ?? "",
      audioMimeType: stop.audioMimeType ?? "",
      audioCredit: stop.audioCredit ?? "",
      audioLicense: stop.audioLicense ?? "",
      audioDurationSeconds:
        stop.audioDurationSeconds === undefined
          ? ""
          : String(stop.audioDurationSeconds),
      transcript: stop.transcript ?? ""
    }))
  };
}

function buildDraft(form: DraftForm): {
  draft: StudioDraftTour | null;
  errors: string[];
  raw: unknown;
} {
  const raw = {
    id: form.id,
    title: form.title.trim(),
    description: form.description.trim(),
    city: form.city.trim(),
    countryCode: optionalUppercase(form.countryCode),
    locale: form.locale.trim() || "en",
    tourCode: normalizeTourCodeInput(form.tourCode),
    route: form.route.map((point) => ({
      latitude: coordinateNumber(point.latitude),
      longitude: coordinateNumber(point.longitude)
    })),
    stops: form.stops.map((stop) => ({
      id: stop.id,
      title: stop.title.trim(),
      summary: optionalString(stop.summary),
      coordinate: {
        latitude: coordinateNumber(stop.latitude),
        longitude: coordinateNumber(stop.longitude)
      },
      audioUrl: stop.audioUrl.trim(),
      audioStoragePath: optionalString(stop.audioStoragePath),
      audioFileName: optionalString(stop.audioFileName),
      audioMimeType: optionalString(stop.audioMimeType),
      audioCredit: optionalString(stop.audioCredit),
      audioLicense: optionalString(stop.audioLicense),
      audioDurationSeconds: optionalNumber(stop.audioDurationSeconds),
      transcript: optionalString(stop.transcript)
    }))
  };
  const parsed = StudioDraftTourSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      draft: null,
      errors: parsed.error.issues.map(formatIssue),
      raw
    };
  }

  return {
    draft: parsed.data,
    errors: [],
    raw
  };
}

function buildPreviewManifest(draft: StudioDraftTour | null): {
  errors: string[];
  manifest: PublishedTourManifest | null;
} {
  if (!draft) {
    return { errors: [], manifest: null };
  }

  try {
    return {
      errors: [],
      manifest: buildPublishedTourManifestFromDraft(draft, {
        publishId: "preview",
        publishedAt: new Date(0).toISOString(),
        contentHash: "sha256-preview"
      })
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : "Manifest is invalid."],
      manifest: null
    };
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-000000000000";
}

function normalizeTourCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalUppercase(value: string): string | undefined {
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _ignored, ...next } = record;

  return next;
}

function getAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    let isSettled = false;

    const timeoutId = window.setTimeout(() => {
      settle(() =>
        reject(new Error("Audio duration could not be read from this file."))
      );
    }, 10000);

    const settle = (callback: () => void) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeoutId);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      callback();
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      settle(() => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          reject(new Error("Audio duration could not be read from this file."));
          return;
        }

        resolve(Math.round(audio.duration));
      });
    };
    audio.onerror = () => {
      settle(() =>
        reject(new Error("Audio duration could not be read from this file."))
      );
    };
    audio.src = objectUrl;
  });
}

function coordinateNumber(value: string): number {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : Number.NaN;
}

function formatIssue(issue: { message: string; path: (number | string)[] }) {
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Published";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDurationSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
