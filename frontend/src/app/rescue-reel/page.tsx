"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { rescueReelApi, RescuePrompts, ReelStyle, ReelSession } from "@/lib/rescueReelApi";

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface VideoState {
  taskId: string | null;
  status: "idle" | "pending" | "generating" | "success" | "failed";
  url: string | null;
  error: string | null;
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const WandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2L11 5"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);
const VideoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);
const MergeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6v6"/><path d="M16 6v6"/><path d="M8 12c0 4 4 4 4 4s4 0 4-4"/><circle cx="12" cy="18" r="2"/>
  </svg>
);
const FilmIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const RegenIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 18 5.29"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SparklesIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3z"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

// ── Step bar ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Prompts", icon: <WandIcon /> },
  { id: 2, label: "Images", icon: <ImageIcon /> },
  { id: 3, label: "Videos", icon: <VideoIcon /> },
  { id: 4, label: "Merge", icon: <MergeIcon /> },
  { id: 5, label: "Export", icon: <FilmIcon /> },
];

function StepBar({ current }: { current: Step }) {
  return (
    <div className="steps">
      {STEPS.map((s, i) => {
        const state = s.id < current ? "done" : s.id === current ? "active" : "";
        return (
          <span key={s.id} style={{ display: "contents" }}>
            <div className={`step ${state}`}>
              {state === "done" ? <CheckIcon /> : <span className="step-num">{String(s.id).padStart(2, "0")}</span>}
              <span>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="step-sep"><ChevronRight /></span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button className={`iconbtn ${copied ? "copied-flash" : ""}`} onClick={copy} title="Copy">
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

// ── Prompt block ───────────────────────────────────────────────────────────────

function PromptBlock({
  label, color, text, loading, onCopy, onRegen,
}: {
  label: string; color: string; text: string;
  loading?: boolean; onCopy: () => void; onRegen: () => void;
}) {
  return (
    <div className={`prompt-block ${loading ? "regenerating" : ""}`}>
      <div className="ph">
        <span className={`badge ${color}`}>{label}</span>
        <div className="actions">
          <CopyBtn text={text} />
          <button className="iconbtn purple" title="Regenerate" onClick={onRegen}>
            {loading
              ? <span className="ring-spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} />
              : <RegenIcon />}
          </button>
        </div>
      </div>
      <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "6.5em", overflow: "hidden" }}>{text}</pre>
    </div>
  );
}

// ── Card section ───────────────────────────────────────────────────────────────

function CardSection({ title, icon, children, extra }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="purple-text">{icon}</span>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</h4>
        {extra && <div style={{ marginLeft: "auto" }}>{extra}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Video progress card ────────────────────────────────────────────────────────

function VideoProgressCard({ index, status, url, error }: {
  index: number; status: VideoState["status"]; url: string | null; error: string | null;
}) {
  const label = `Video ${index}`;
  const sub = index === 1 ? "Frame 1 → Frame 2" : "Frame 2 → Frame 3";
  const tone = status === "success" ? "done" : status === "failed" ? "failed" : "";

  const badge = status === "success"
    ? <span className="badge green"><span className="dot" />Done</span>
    : status === "failed"
    ? <span className="badge red"><span className="dot" />Failed</span>
    : status === "generating" || status === "pending"
    ? <span className="badge amber"><span className="dot" />{status === "pending" ? "Submitting" : "Generating"}</span>
    : <span className="badge gray">Waiting</span>;

  return (
    <div className={`vp-card ${tone}`}>
      <div className="vp-head">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          <div className="hint">{sub} · 8s</div>
        </div>
        {badge}
      </div>
      {status === "success" && url ? (
        <div className="video-frame">
          <video src={url} controls style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        </div>
      ) : status === "failed" && error ? (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: 10, color: "#fca5a5", fontSize: 12 }}>
          {error}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="ds-progress indeterminate"><div className="fill" /></div>
          <div className="hint" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{status === "idle" ? "In queue" : status === "pending" ? "Submitting to Veo 3.1…" : "Generating 8s clip…"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RescueReelPage() {
  const [step, setStep] = useState<Step>(1);
  const [scene, setScene] = useState("");
  const [style, setStyle] = useState<ReelStyle>("natural");
  const [prompts, setPrompts] = useState<RescuePrompts | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<ReelSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [video1, setVideo1] = useState<VideoState>({ taskId: null, status: "idle", url: null, error: null });
  const [video2, setVideo2] = useState<VideoState>({ taskId: null, status: "idle", url: null, error: null });
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenPromptLoading, setRegenPromptLoading] = useState<Record<string, boolean>>({});
  const [regenImageLoading, setRegenImageLoading] = useState<Record<number, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearError = () => setError(null);

  // ── Sessions ────────────────────────────────────────────────────────────────

  useEffect(() => {
    rescueReelApi.listSessions().then(r => setSessions(r.data)).catch(() => {});
  }, []);

  const saveSession = useCallback(async (patch: Partial<Parameters<typeof rescueReelApi.saveSession>[0]>) => {
    try {
      const { data } = await rescueReelApi.saveSession({
        id: sessionId ?? undefined,
        scene,
        style,
        status: "draft",
        image_prompts: prompts?.image_prompts ?? null,
        video_prompts: prompts?.video_prompts ?? null,
        caption: prompts?.caption ?? null,
        image_urls: imageUrls.length === 3 ? imageUrls as [string,string,string] : null,
        video_url_1: video1.url,
        video_url_2: video2.url,
        final_video_url: finalVideoUrl,
        ...patch,
      });
      setSessionId(data.id);
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === data.id);
        return idx >= 0 ? prev.map(s => s.id === data.id ? data : s) : [data, ...prev];
      });
    } catch { /* non-critical */ }
  }, [sessionId, scene, style, prompts, imageUrls, video1.url, video2.url, finalVideoUrl]);

  const loadSession = (s: ReelSession) => {
    setSessionId(s.id);
    setScene(s.scene);
    setStyle(s.style);
    if (s.image_prompts && s.video_prompts) {
      setPrompts({ image_prompts: s.image_prompts, video_prompts: s.video_prompts, caption: s.caption ?? "" });
      setStep(2);
    }
    if (s.image_urls) {
      setImageUrls(s.image_urls);
      setStep(3);
    }
    if (s.video_url_1 && s.video_url_2) {
      setVideo1(p => ({ ...p, status: "success", url: s.video_url_1 }));
      setVideo2(p => ({ ...p, status: "success", url: s.video_url_2 }));
      setStep(4);
    }
    if (s.final_video_url) {
      setFinalVideoUrl(s.final_video_url);
      setStep(5);
    }
    setShowSessions(false);
  };

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await rescueReelApi.deleteSession(id).catch(() => {});
    setSessions(prev => prev.filter(s => s.id !== id));
    if (sessionId === id) { setSessionId(null); }
  };

  // ── Step 1 ──────────────────────────────────────────────────────────────────

  const handleGeneratePrompts = async () => {
    if (!scene.trim()) return;
    setLoading(true);
    clearError();
    try {
      const { data } = await rescueReelApi.generatePrompts(scene, style);
      setPrompts(data);
      setStep(2);
      await saveSession({ image_prompts: data.image_prompts, video_prompts: data.video_prompts, caption: data.caption, status: "draft" });
    } catch (e: unknown) {
      setError(`Prompt generation failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenPrompt = async (promptType: string) => {
    if (!prompts) return;
    setRegenPromptLoading(prev => ({ ...prev, [promptType]: true }));
    try {
      const { data } = await rescueReelApi.regeneratePrompt(scene, style, promptType, prompts);
      setPrompts(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        if (promptType === "image_0") next.image_prompts = [data.value, prev.image_prompts[1], prev.image_prompts[2]];
        if (promptType === "image_1") next.image_prompts = [prev.image_prompts[0], data.value, prev.image_prompts[2]];
        if (promptType === "image_2") next.image_prompts = [prev.image_prompts[0], prev.image_prompts[1], data.value];
        if (promptType === "video_0") next.video_prompts = [data.value, prev.video_prompts[1]];
        if (promptType === "video_1") next.video_prompts = [prev.video_prompts[0], data.value];
        if (promptType === "caption") next.caption = data.value;
        return next;
      });
    } catch (e: unknown) {
      setError(`Prompt regen failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRegenPromptLoading(prev => ({ ...prev, [promptType]: false }));
    }
  };

  // ── Step 2 ──────────────────────────────────────────────────────────────────

  const handleGenerateImages = async () => {
    if (!prompts) return;
    setLoading(true);
    clearError();

    setImageUrls(["", "", ""]);
    setRegenImageLoading({ 0: true, 1: true, 2: true });
    setStep(3);

    // Generate Frame 1 first — it becomes the reference image for Frames 2 & 3
    let frame1Url: string | null = null;
    try {
      const { data } = await rescueReelApi.regenerateImage(prompts.image_prompts[0], 0, null);
      frame1Url = data.image_url;
      setImageUrls(prev => { const n = [...prev]; n[0] = data.image_url; return n; });
    } catch (e: unknown) {
      setError(`Frame 1 failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRegenImageLoading(prev => ({ ...prev, 0: false }));
    }

    // Generate Frames 2 & 3 in parallel, using Frame 1 as reference for consistency
    await Promise.all([1, 2].map(async (i) => {
      try {
        const { data } = await rescueReelApi.regenerateImage(prompts.image_prompts[i], i, frame1Url);
        setImageUrls(prev => { const n = [...prev]; n[i] = data.image_url; return n; });
      } catch (e: unknown) {
        setError(`Frame ${i + 1} failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      } finally {
        setRegenImageLoading(prev => ({ ...prev, [i]: false }));
      }
    }));

    // Save after all frames done
    const finalUrls = imageUrls.length === 3 ? imageUrls : [];
    if (finalUrls.every(u => u)) saveSession({ image_urls: finalUrls as [string,string,string], status: "images_done" });
    setLoading(false);
  };

  const handleRegenImage = async (index: number) => {
    if (!prompts) return;
    setRegenImageLoading(prev => ({ ...prev, [index]: true }));
    // Pass Frame 1 as reference when regenerating frames 1 or 2
    const refUrl = index > 0 ? (imageUrls[0] ?? null) : null;
    try {
      const { data } = await rescueReelApi.regenerateImage(prompts.image_prompts[index], index, refUrl);
      setImageUrls(prev => { const n = [...prev]; n[index] = data.image_url; return n; });
    } catch (e: unknown) {
      setError(`Image ${index + 1} regen failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRegenImageLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  // ── Step 3 ──────────────────────────────────────────────────────────────────

  const pollVideo = useCallback(async (taskId: string, setter: React.Dispatch<React.SetStateAction<VideoState>>) => {
    try {
      const { data } = await rescueReelApi.getVideoStatus(taskId);
      if (data.state === "success") { setter(p => ({ ...p, status: "success", url: data.video_url })); return true; }
      if (data.state === "failed") { setter(p => ({ ...p, status: "failed", error: data.error })); return true; }
    } catch { /* keep polling */ }
    return false;
  }, []);

  const handleGenerateVideos = async () => {
    if (!prompts || imageUrls.length !== 3) return;
    setLoading(true);
    clearError();
    try {
      setVideo1(p => ({ ...p, status: "pending" }));
      setVideo2(p => ({ ...p, status: "pending" }));
      const { data } = await rescueReelApi.generateVideos(imageUrls, prompts.video_prompts);
      setVideo1({ taskId: data.task_id_1, status: "generating", url: null, error: null });
      setVideo2({ taskId: data.task_id_2, status: "generating", url: null, error: null });
      setStep(4);
      let v1Done = false, v2Done = false;
      const interval = setInterval(async () => {
        if (!v1Done) v1Done = await pollVideo(data.task_id_1, setVideo1);
        if (!v2Done) v2Done = await pollVideo(data.task_id_2, setVideo2);
        if (v1Done && v2Done) {
          clearInterval(interval);
          pollRef.current = null;
          // Save video URLs from state — read via setters
          setVideo1(v1 => { setVideo2(v2 => { saveSession({ video_url_1: v1.url, video_url_2: v2.url, status: "videos_done" }); return v2; }); return v1; });
        }
      }, 8000);
      pollRef.current = interval;
    } catch (e: unknown) {
      setError(`Video generation failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      setVideo1(p => ({ ...p, status: "idle" }));
      setVideo2(p => ({ ...p, status: "idle" }));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 4 ──────────────────────────────────────────────────────────────────

  const handleMerge = async () => {
    if (!video1.url || !video2.url) return;
    setLoading(true);
    clearError();
    try {
      const { data } = await rescueReelApi.mergeVideos(video1.url, video2.url);
      setFinalVideoUrl(data.video_url);
      setStep(5);
      saveSession({ final_video_url: data.video_url, status: "completed" });
    } catch (e: unknown) {
      setError(`Merge failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryVideo = async (videoIndex: 1 | 2) => {
    if (!prompts || imageUrls.length < 3) return;
    const setter = videoIndex === 1 ? setVideo1 : setVideo2;
    setter(p => ({ ...p, status: "generating", error: null, taskId: null }));

    try {
      const urlStart = videoIndex === 1 ? imageUrls[0] : imageUrls[1];
      const urlEnd   = videoIndex === 1 ? imageUrls[1] : imageUrls[2];
      const prompt   = videoIndex === 1 ? prompts.video_prompts[0] : prompts.video_prompts[1];
      const { data } = await rescueReelApi.generateSingleVideo(urlStart, urlEnd, prompt);
      setter(p => ({ ...p, taskId: data.task_id }));

      const interval = setInterval(async () => {
        const done = await pollVideo(data.task_id, setter);
        if (done) clearInterval(interval);
      }, 8000);
    } catch (e: unknown) {
      setter(p => ({ ...p, status: "failed", error: e instanceof Error ? e.message : "Retry failed" }));
    }
  };

  const bothVideosDone = video1.status === "success" && video2.status === "success";
  const anyVideoFailed = video1.status === "failed" || video2.status === "failed";
  const videosPolling = !bothVideosDone && !anyVideoFailed && (video1.status === "generating" || video2.status === "generating");

  return (
    <div className="reel fade-enter">
      {/* Sticky header */}
      <div className="reel-header">
        <div className="row">
          <Link href="/" className="iconbtn" style={{ width: 32, height: 32 }} title="Back to dashboard">
            <ArrowLeft />
          </Link>
          <div style={{ flex: 1 }}>
            <h1>Rescue Reel Generator</h1>
            <p>AI-powered animal rescue reel — fully automated · ~3 min end-to-end</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="iconbtn"
              style={{ width: "auto", padding: "0 10px", gap: 5, fontSize: 12, fontWeight: 600 }}
              onClick={() => setShowSessions(v => !v)}
              title="Previous sessions"
            >
              <FilmIcon /> History {sessions.length > 0 && <span className="badge purple" style={{ padding: "1px 5px", fontSize: 10 }}>{sessions.length}</span>}
            </button>
            <span className="badge purple"><SparklesIcon /> Veo 3.1 Fast + Flux</span>
          </div>

          {/* Session history drawer */}
          {showSessions && (
            <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 100, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 10, minWidth: 320, maxWidth: 420, maxHeight: 400, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Previous Sessions</div>
              {sessions.length === 0
                ? <div className="hint" style={{ fontSize: 11 }}>No saved sessions yet.</div>
                : sessions.map(s => (
                  <div key={s.id} onClick={() => loadSession(s)}
                    style={{ cursor: "pointer", padding: "8px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, marginBottom: 4, background: sessionId === s.id ? "rgba(168,85,247,0.12)" : "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = sessionId === s.id ? "rgba(168,85,247,0.12)" : "transparent")}
                  >
                    <span className={`badge ${s.status === "completed" ? "green" : s.status === "videos_done" ? "amber" : "gray"}`} style={{ fontSize: 10, padding: "1px 6px", flexShrink: 0 }}>
                      {s.status === "completed" ? "Done" : s.status === "videos_done" ? "Videos" : s.status === "images_done" ? "Images" : "Draft"}
                    </span>
                    <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.scene}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>{new Date(s.updated_at).toLocaleDateString()}</span>
                    <button className="iconbtn" style={{ width: 22, height: 22, flexShrink: 0 }} onClick={e => deleteSession(s.id, e)} title="Delete"><XIcon /></button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <StepBar current={step} />
          </div>
        </div>
      </div>

      <div className="reel-inner">

        {/* Error banner */}
        {error && (
          <div className="error-banner" style={{ marginBottom: 18 }}>
            <AlertIcon />
            <span>{error}</span>
            <button className="iconbtn" onClick={clearError} style={{ marginLeft: "auto" }}><XIcon /></button>
          </div>
        )}

        {/* ── Step 1 — Scene description ── */}
        <section>
          <div className="section-head">
            <div className="num"><WandIcon /></div>
            <h3>Describe the rescue scene</h3>
            <span className="sub">Step 01</span>
          </div>
          <p className="hint" style={{ margin: "0 0 10px" }}>
            Two or three sentences describing the story arc. Claude turns it into 3 image prompts, 2 video prompts, and a Facebook caption.
          </p>
          <textarea
            className="ds-textarea"
            placeholder="A small puppy is found shivering behind a market on a rainy night…"
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            style={{ minHeight: 110 }}
            disabled={step > 1}
          />
          {step === 1 && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {(["natural", "cctv"] as ReelStyle[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: style === s ? "1.5px solid #a855f7" : "1.5px solid rgba(255,255,255,0.1)",
                      background: style === s ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                      color: style === s ? "#e2d5fa" : "var(--text-2)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "0.02em",
                      transition: "all 0.15s",
                    }}
                  >
                    {s === "natural" ? "🎥 Natural / Cinematic" : "📹 CCTV Security Cam"}
                  </button>
                ))}
              </div>
              <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                {style === "cctv"
                  ? "Overhead security camera aesthetic — grainy, timestamp overlay, static angle."
                  : "Ground-level documentary style — realistic lighting, natural perspective."}
              </p>
              <button
                className="btn primary block lg"
                disabled={loading || !scene.trim()}
                onClick={handleGeneratePrompts}
                style={{ marginTop: 10 }}
              >
                {loading ? <><span className="spinner" /> Generating prompts with Claude…</> : <><WandIcon /> Generate Prompts</>}
              </button>
            </>
          )}
        </section>

        {/* ── Step 2 — Review prompts ── */}
        {prompts && step >= 2 && (
          <section>
            <div className="section-head">
              <div className="num"><ImageIcon /></div>
              <h3>Review prompts &amp; generate images</h3>
              <span className="sub">Step 02</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CardSection
                title="Image Prompts"
                icon={<ImageIcon />}
                extra={<span className="badge purple">3 frames</span>}
              >
                {(["Opening Frame", "Middle Frame", "Ending Frame"] as const).map((label, i) => (
                  <PromptBlock
                    key={i}
                    label={label}
                    color={i === 0 ? "amber" : i === 1 ? "purple" : "green"}
                    text={prompts.image_prompts[i]}
                    loading={regenPromptLoading[`image_${i}`]}
                    onCopy={() => {}}
                    onRegen={() => handleRegenPrompt(`image_${i}`)}
                  />
                ))}
              </CardSection>

              <CardSection
                title="Video Prompts"
                icon={<VideoIcon />}
                extra={<span className="badge purple">2 clips</span>}
              >
                {(["Video 1 · Frame 1 → 2", "Video 2 · Frame 2 → 3"] as const).map((label, i) => (
                  <PromptBlock
                    key={i}
                    label={label}
                    color="purple"
                    text={prompts.video_prompts[i]}
                    loading={regenPromptLoading[`video_${i}`]}
                    onCopy={() => {}}
                    onRegen={() => handleRegenPrompt(`video_${i}`)}
                  />
                ))}
              </CardSection>

              <CardSection title="Reel Caption" icon={<FilmIcon />}>
                <PromptBlock
                  label="Facebook Reel"
                  color="green"
                  text={prompts.caption}
                  loading={regenPromptLoading["caption"]}
                  onCopy={() => {}}
                  onRegen={() => handleRegenPrompt("caption")}
                />
              </CardSection>
            </div>

            {step === 2 && (
              <button
                className="btn primary block lg"
                onClick={handleGenerateImages}
                disabled={loading}
                style={{ marginTop: 14 }}
              >
                {loading
                  ? <><span className="spinner" /> Generating images (this takes ~30s each)…</>
                  : <><ImageIcon /> Generate 3 Images with FLUX</>}
              </button>
            )}
          </section>
        )}

        {/* ── Step 3 — Frames review ── */}
        {imageUrls.length === 3 && step >= 3 && (
          <section>
            <div className="section-head">
              <div className="num"><VideoIcon /></div>
              <h3>Review frames &amp; generate videos</h3>
              <span className="sub">Step 03</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {imageUrls.map((url, i) => (
                <div className="frame-card" key={i}>
                  {regenImageLoading[i] ? (
                    <div className="overlay-loader" style={{ background: "rgba(10,10,15,0.92)" }}>
                      <span className="ring-spinner lg" />
                      <span style={{ fontSize: 11 }}>Regenerating frame…</span>
                    </div>
                  ) : (
                    <img src={url} alt={`Frame ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  <span className="frame-pill">Frame {i + 1}</span>
                  <div className="redo-overlay">
                    <button
                      className="btn primary"
                      onClick={() => handleRegenImage(i)}
                      disabled={regenImageLoading[i]}
                    >
                      <RegenIcon /> Redo Frame {i + 1}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {step === 3 && (
              <button
                className="btn primary block lg"
                onClick={handleGenerateVideos}
                disabled={loading || Object.values(regenImageLoading).some(Boolean)}
                style={{ marginTop: 14 }}
              >
                {loading
                  ? <><span className="spinner" /> Submitting to Veo 3.1…</>
                  : <><VideoIcon /> Generate 2 × 8s Videos (Veo 3.1 Fast)</>}
              </button>
            )}
          </section>
        )}

        {/* ── Step 4 — Video progress + merge ── */}
        {step >= 4 && (
          <section>
            <div className="section-head">
              <div className="num"><MergeIcon /></div>
              <h3>Video generation &amp; merge</h3>
              <span className="sub">Step 04</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ v: video1, idx: 1 }, { v: video2, idx: 2 }].map(({ v, idx }) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <VideoProgressCard index={idx} status={v.status} url={v.url} error={v.error} />
                  {v.status === "failed" && (
                    <button
                      className="btn primary block"
                      style={{ fontSize: 12, padding: "7px 12px" }}
                      onClick={() => handleRetryVideo(idx as 1 | 2)}
                    >
                      <RegenIcon /> Retry Video {idx}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {videosPolling && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "var(--text-3)", fontSize: 12 }}>
                <span className="ring-spinner" style={{ width: 12, height: 12 }} />
                <span>Waiting for Veo 3.1 Fast — polling every 8s…</span>
              </div>
            )}

            {bothVideosDone && step === 4 && (
              <button
                className="btn success block lg"
                onClick={handleMerge}
                disabled={loading}
                style={{ marginTop: 14 }}
              >
                {loading
                  ? <><span className="spinner" /> Merging…</>
                  : <><MergeIcon /> Merge into Final 16s Reel</>}
              </button>
            )}
          </section>
        )}

        {/* ── Step 5 — Export ── */}
        {step === 5 && finalVideoUrl && (
          <section>
            <div className="section-head">
              <div className="num" style={{ background: "rgba(22,163,74,0.14)", borderColor: "rgba(22,163,74,0.4)", color: "#4ade80" }}>
                <FilmIcon />
              </div>
              <h3 className="green-text">Your Rescue Reel is ready!</h3>
              <span className="sub">Step 05 · 16s · 9:16 · 1080p</span>
            </div>

            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 18px" }}>
              <div className="video-frame vert" style={{ width: 280 }}>
                <video
                  src={finalVideoUrl}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={finalVideoUrl}
                download="rescue_reel.mp4"
                className="btn success block lg"
                style={{ textDecoration: "none" }}
              >
                <DownloadIcon /> Download Final Reel (MP4)
              </a>
              <button
                className="btn ghost block"
                onClick={() => {
                  setStep(1); setScene(""); setPrompts(null); setImageUrls([]);
                  setVideo1({ taskId: null, status: "idle", url: null, error: null });
                  setVideo2({ taskId: null, status: "idle", url: null, error: null });
                  setFinalVideoUrl(null);
                  if (pollRef.current) clearInterval(pollRef.current);
                }}
              >
                Start a new reel
              </button>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
