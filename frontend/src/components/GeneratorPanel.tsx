"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram, UpdateStereogramPayload } from "@/lib/types";

const COLOR_MODE_OPTIONS = [
  { label: "Random", value: "random" },
  { label: "Warm", value: "warm" },
  { label: "Cool", value: "cool" },
  { label: "Festive", value: "festive" },
];

const CONTENT_TYPES = [
  { value: "stereogram", label: "Magic Eye" },
  { value: "illusion", label: "Optical Illusion" },
];

function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${url}`;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface GeneratorPanelProps {
  selectedStereogram: Stereogram | null;
}

export function GeneratorPanel({ selectedStereogram }: GeneratorPanelProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [localForm, setLocalForm] = useState<UpdateStereogramPayload>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  type CaptionVariation = { label: string; caption: string };
  type Captions = { variation_a: CaptionVariation; variation_b: CaptionVariation; variation_c: CaptionVariation };
  const [captions, setCaptions] = useState<Captions | null>(null);
  const [loadingCaption, setLoadingCaption] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"a" | "b" | "c">("a");
  const [copied, setCopied] = useState(false);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(resolveAssetUrl(url));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(resolveAssetUrl(url), "_blank");
    }
  };

  const { data: liveData } = useQuery<Stereogram>({
    queryKey: ["stereogram", selectedStereogram?.id],
    queryFn: async () => {
      const res = await api.getStereogram(selectedStereogram!.id);
      return res.data;
    },
    enabled: !!selectedStereogram,
    refetchInterval: isGenerating ? 2000 : false,
  });

  const stereogram = liveData || selectedStereogram;

  useEffect(() => {
    if (selectedStereogram) {
      setLocalForm({
        background_pattern: selectedStereogram.background_pattern,
        hidden_object: selectedStereogram.hidden_object,
        hidden_object_type: selectedStereogram.hidden_object_type ?? "image",
        theme: selectedStereogram.theme,
        depth_intensity: selectedStereogram.depth_intensity,
        color_mode: selectedStereogram.color_mode,
        dot_density: selectedStereogram.dot_density,
      });
      setIsGenerating(selectedStereogram.status === "generating");
      setCaptionError(null);
    }
  }, [selectedStereogram?.id]);

  useEffect(() => {
    if (liveData?.captions) {
      try { setCaptions(JSON.parse(liveData.captions) as Captions); } catch { setCaptions(null); }
    } else {
      setCaptions(null);
    }
  }, [liveData?.id, liveData?.captions]);

  useEffect(() => {
    if (stereogram?.status === "generated" && isGenerating) {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
    }
    if (stereogram?.status === "generating") setIsGenerating(true);
  }, [stereogram?.status]);

  const debouncedSave = useCallback(
    (id: number, updates: UpdateStereogramPayload) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        await api.updateStereogram(id, updates);
        queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      }, 500);
    },
    [queryClient]
  );

  const handleChange = (field: keyof UpdateStereogramPayload, value: string | number) => {
    const updated = { ...localForm, [field]: value };
    setLocalForm(updated);
    if (stereogram?.id) debouncedSave(stereogram.id, { [field]: value });
  };

  const handleGenerate = async () => {
    if (!stereogram) return;
    setIsGenerating(true);
    try {
      await api.generateStereogram(stereogram.id);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      queryClient.invalidateQueries({ queryKey: ["stereogram", stereogram.id] });
    } catch { setIsGenerating(false); }
  };

  const handleRegenerate = async () => {
    if (!stereogram) return;
    setIsGenerating(true);
    try {
      await api.regenerateStereogram(stereogram.id);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      queryClient.invalidateQueries({ queryKey: ["stereogram", stereogram.id] });
    } catch { setIsGenerating(false); }
  };

  const handleGenerateCaption = async () => {
    if (!stereogram) return;
    setLoadingCaption(true);
    setCaptionError(null);
    setCaptions(null);
    try {
      const res = await api.generateCaption(stereogram.id);
      setCaptions(res.data as Captions);
      setActiveTab("a");
      queryClient.invalidateQueries({ queryKey: ["stereogram", stereogram.id] });
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCaptionError(msg || "Caption generation failed.");
    } finally {
      setLoadingCaption(false);
    }
  };

  const handleCopyCaption = () => {
    if (!captions) return;
    const key = `variation_${activeTab}` as keyof Captions;
    navigator.clipboard.writeText(captions[key].caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!stereogram) return null;

  const formData = {
    background_pattern: localForm.background_pattern ?? stereogram.background_pattern,
    hidden_object: localForm.hidden_object ?? stereogram.hidden_object,
    hidden_object_type: (localForm.hidden_object_type ?? stereogram.hidden_object_type ?? "image") as "text" | "image",
    theme: localForm.theme ?? stereogram.theme,
    depth_intensity: localForm.depth_intensity ?? stereogram.depth_intensity,
    color_mode: localForm.color_mode ?? stereogram.color_mode,
    dot_density: localForm.dot_density ?? stereogram.dot_density,
  };

  const isGenerated = stereogram.status === "generated";
  const isIllusion = (stereogram.content_type ?? "stereogram") === "illusion";

  return (
    <>
      {/* Item header */}
      <div className="gen-item-header">
        <div style={{ flex: 1 }}>
          <div className="text-3" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500 }}>
            Item #{String(stereogram.post_number ?? stereogram.id).padStart(2, "0")} · {fmtDate(stereogram.scheduled_date)}
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {stereogram.background_pattern}{" "}
            <span className="text-3" style={{ fontWeight: 400 }}>·</span>{" "}
            <span className="purple-text">{stereogram.hidden_object}</span>
          </h2>
        </div>
        {isGenerating ? (
          <span className="badge amber"><span className="dot" />Generating</span>
        ) : isGenerated ? (
          <span className="badge green"><span className="dot" />Generated</span>
        ) : (
          <span className="badge gray">Not Started</span>
        )}
      </div>

      {/* Parameters */}
      <div className="gen-section">
        <div className="field">
          <label className="field-label">Content Type</label>
          <div className="pill-tabs">
            {CONTENT_TYPES.map(t => (
              <button
                key={t.value}
                className={stereogram.content_type === t.value ? "active" : ""}
                onClick={() => handleChange("content_type" as keyof UpdateStereogramPayload, t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label className="field-label">Background Pattern</label>
            <input
              className="ds-input"
              value={formData.background_pattern}
              onChange={(e) => handleChange("background_pattern", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Hidden Object</span>
              <div className="seg-toggle">
                <button
                  className={formData.hidden_object_type === "text" ? "active" : ""}
                  onClick={() => handleChange("hidden_object_type", "text")}
                >Text</button>
                <button
                  className={formData.hidden_object_type === "image" ? "active" : ""}
                  onClick={() => handleChange("hidden_object_type", "image")}
                >Image</button>
              </div>
            </label>
            <input
              className="ds-input"
              value={formData.hidden_object}
              onChange={(e) => handleChange("hidden_object", e.target.value)}
            />
          </div>
        </div>

        <div className="slider-row">
          <div className="slider-head">
            <span className="lbl">Depth Intensity</span>
            <span className="val">{Number(formData.depth_intensity).toFixed(2)}</span>
          </div>
          <input
            type="range" className="ds-slider"
            min={0.1} max={0.6} step={0.01}
            value={formData.depth_intensity}
            onChange={(e) => handleChange("depth_intensity", parseFloat(e.target.value))}
          />
        </div>
        {!isIllusion && (
          <div className="slider-row">
            <div className="slider-head">
              <span className="lbl">Dot Density</span>
              <span className="val">{formData.dot_density}</span>
            </div>
            <input
              type="range" className="ds-slider"
              min={1} max={10} step={1}
              value={formData.dot_density}
              onChange={(e) => handleChange("dot_density", parseInt(e.target.value))}
            />
          </div>
        )}

        <div className="field">
          <label className="field-label">Color Mode</label>
          <div className="select-wrap">
            <select
              className="ds-select"
              value={formData.color_mode}
              onChange={(e) => handleChange("color_mode", e.target.value)}
            >
              {COLOR_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 4 }}>
          <button
            className="btn primary block"
            disabled={isGenerating}
            onClick={isGenerated ? handleRegenerate : handleGenerate}
          >
            {isGenerating ? (
              <><span className="spinner" /> Generating…</>
            ) : isGenerated ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 18 5.29"/>
                </svg>
                Regenerate
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2L11 5"/>
                </svg>
                Generate Stereogram
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="gen-section">
        <div className="gen-title">
          <h2>Preview</h2>
          <span className="sub">1200 × 800 px</span>
        </div>
        <div className="preview-grid">
          {/* ── Main image tile ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="preview-tile">
              {liveData?.image_url ? (
                <img
                  src={resolveAssetUrl(liveData.image_url)}
                  alt="Stereogram"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: 6 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span style={{ fontSize: 11.5 }}>{isIllusion ? "Optical Illusion" : "Magic Eye"}</span>
                </div>
              )}
              {isGenerating && (
                <div className="overlay-loader">
                  <span className="ring-spinner" />
                  <span>Generating…</span>
                </div>
              )}
              <span className="label">{isIllusion ? "Optical Illusion" : "Magic Eye"}</span>
            </div>
            {liveData?.image_url && !isGenerating && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn secondary"
                  style={{ flex: 1, fontSize: 12, padding: "5px 0" }}
                  onClick={() => setLightbox({ url: liveData.image_url!, label: "Stereogram" })}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Preview
                </button>
                <button
                  className="btn secondary"
                  style={{ flex: 1, fontSize: 12, padding: "5px 0" }}
                  onClick={() => handleDownload(liveData.image_url!, `stereogram-${stereogram.id}.png`)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
              </div>
            )}
          </div>

          {/* ── Depth map tile ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="preview-tile">
              {liveData?.depth_map_url ? (
                <img
                  src={resolveAssetUrl(liveData.depth_map_url)}
                  alt="Depth Map"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: 6 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                  </svg>
                  <span style={{ fontSize: 11.5 }}>{isIllusion ? "Control Image" : "Depth Map"}</span>
                </div>
              )}
              {isGenerating && <div className="overlay-loader"><span className="ring-spinner" /></div>}
              <span className="label">{isIllusion ? "Control Image" : "Depth Map"}</span>
            </div>
            {liveData?.depth_map_url && !isGenerating && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn secondary"
                  style={{ flex: 1, fontSize: 12, padding: "5px 0" }}
                  onClick={() => setLightbox({ url: liveData.depth_map_url!, label: "Depth Map" })}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Preview
                </button>
                <button
                  className="btn secondary"
                  style={{ flex: 1, fontSize: 12, padding: "5px 0" }}
                  onClick={() => handleDownload(liveData.depth_map_url!, `depth-map-${stereogram.id}.png`)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="gen-section">
        <div className="gen-title">
          <h2>Facebook Caption</h2>
          <button
            className="btn primary sm"
            onClick={handleGenerateCaption}
            disabled={loadingCaption || !isGenerated}
            style={{ fontSize: 12 }}
          >
            {loadingCaption ? (
              <><span className="spinner" /> Generating…</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {captions ? "Regenerate" : "Generate Caption"}
              </>
            )}
          </button>
        </div>

        {!isGenerated && !loadingCaption && !captions && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Generate the {isIllusion ? "optical illusion" : "stereogram"} first to create a caption.
          </p>
        )}

        {captionError && (
          <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "8px 12px" }}>
            {captionError}
          </div>
        )}

        {captions && (
          <>
            <div className="pill-tabs" style={{ marginBottom: 10 }}>
              {(["a", "b", "c"] as const).map((k) => {
                const v = captions[`variation_${k}` as keyof Captions];
                return (
                  <button
                    key={k}
                    className={activeTab === k ? "active" : ""}
                    onClick={() => setActiveTab(k)}
                    style={{ fontSize: 11 }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.65, color: "var(--text-2)", whiteSpace: "pre-wrap", maxHeight: 280, overflowY: "auto" }}>
              {captions[`variation_${activeTab}` as keyof Captions].caption}
            </div>
            <button
              className={`btn ${copied ? "success" : "secondary"} block`}
              style={{ fontSize: 12, marginTop: 8 }}
              onClick={handleCopyCaption}
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Caption
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Lightbox modal ── */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(null)}
        >
          <div
            style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 500, opacity: 0.8 }}>{lightbox.label}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleDownload(lightbox.url, `${lightbox.label.toLowerCase().replace(" ", "-")}-${stereogram.id}.png`)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setLightbox(null)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "5px 12px", color: "#fff", fontSize: 13, cursor: "pointer" }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <img
              src={resolveAssetUrl(lightbox.url)}
              alt={lightbox.label}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8, display: "block" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
