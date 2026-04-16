"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram, UpdateStereogramPayload, PipelineResult } from "@/lib/types";
import { ImagePreview } from "./ImagePreview";

interface GeneratorPanelProps {
  selectedStereogram: Stereogram | null;
}

const SIZE_OPTIONS = [
  { label: "800 × 600", value: "800x600" },
  { label: "1200 × 800", value: "1200x800" },
  { label: "1920 × 1080", value: "1920x1080" },
];

const PALETTE_OPTIONS = [
  { label: "Rainbow", value: "rainbow" },
  { label: "Ocean", value: "ocean" },
  { label: "Forest", value: "forest" },
  { label: "Sunset", value: "sunset" },
  { label: "Cosmic", value: "cosmic" },
];

const IMPOSSIBLE_OBJECT_OPTIONS = [
  { label: "Penrose Triangle", value: "penrose_triangle" },
  { label: "Necker Cube", value: "necker_cube" },
  { label: "Penrose Stairs", value: "penrose_stairs" },
];

const COLOR_MODE_OPTIONS = [
  { label: "Random", value: "random" },
  { label: "Warm", value: "warm" },
  { label: "Cool", value: "cool" },
  { label: "Festive", value: "festive" },
];

const SUBJECT_OPTIONS = [
  { label: "Dolphin", value: "dolphin" },
  { label: "Heart", value: "heart" },
  { label: "Eagle", value: "eagle" },
  { label: "Star", value: "star" },
  { label: "Fish", value: "fish" },
  { label: "Duck", value: "duck" },
  { label: "Butterfly", value: "butterfly" },
  { label: "Cat", value: "cat" },
  { label: "Sun", value: "sun" },
  { label: "Moon", value: "moon" },
];

/** Prepend API base only for relative paths — Supabase returns full https:// URLs. */
function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${url}`;
}

export function GeneratorPanel({ selectedStereogram }: GeneratorPanelProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputSize, setOutputSize] = useState("1200x800");
  const [localForm, setLocalForm] = useState<UpdateStereogramPayload>({});
  const [showGeneratePipeline, setShowGeneratePipeline] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState("rainbow");
  const [isGeneratingPipeline, setIsGeneratingPipeline] = useState(false);
  const [pipelineContentType, setPipelineContentType] = useState<"stereogram" | "illusion" | "impossible_object">("stereogram");
  const [pipelineForm, setPipelineForm] = useState({
    background_pattern: "",
    hidden_object: "dolphin",
    hidden_object_type: "image" as "image" | "text",
    depth_intensity: 0.35,
    color_mode: "random",
    dot_density: 5,
  });
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [reelStatus, setReelStatus] = useState<"idle" | "pending" | "ready" | "error">("idle");
  const [reelVideoUrl, setReelVideoUrl] = useState<string | null>(null);
  const [customDepthMap, setCustomDepthMap] = useState<File | null>(null);
  const [customDepthMapPreview, setCustomDepthMapPreview] = useState<string | null>(null);
  const [customPattern, setCustomPattern] = useState<File | null>(null);
  const [customPatternPreview, setCustomPatternPreview] = useState<string | null>(null);
  const [isRegeneratingReel, setIsRegeneratingReel] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
  }, [selectedStereogram?.id]);

  useEffect(() => {
    if (stereogram?.status === "generated" && isGenerating) {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
    }
    if (stereogram?.status === "generating") {
      setIsGenerating(true);
    }
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
    if (stereogram?.id) {
      debouncedSave(stereogram.id, { [field]: value });
    }
  };

  const handleGenerate = async () => {
    if (!stereogram) return;
    setIsGenerating(true);
    try {
      await api.generateStereogram(stereogram.id);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      queryClient.invalidateQueries({ queryKey: ["stereogram", stereogram.id] });
    } catch {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!stereogram) return;
    setIsGenerating(true);
    try {
      await api.regenerateStereogram(stereogram.id);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      queryClient.invalidateQueries({ queryKey: ["stereogram", stereogram.id] });
    } catch {
      setIsGenerating(false);
    }
  };

  const handleGenerateAll = async (subjectOverride?: string) => {
    setIsGeneratingPipeline(true);
    setGenerationError(null);
    setPipelineResult(null);
    setReelStatus("idle");
    setReelVideoUrl(null);
    setCustomDepthMap(null);
    setCustomDepthMapPreview(null);
    setCustomPattern(null);
    setCustomPatternPreview(null);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const subject = subjectOverride ?? (
        pipelineContentType === "impossible_object"
          ? pipelineForm.background_pattern
          : pipelineForm.hidden_object
      );
      if (!subject) {
        setGenerationError("No subject set — fill in the hidden object first.");
        setIsGeneratingPipeline(false);
        return;
      }

      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
      const response = await fetch(`${BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, palette: selectedPalette }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Generation failed");
      }

      const result = await response.json();
      setPipelineResult(result);
      setReelStatus("pending");

      // Poll for reel completion
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BASE}/api/generate/status/${result.job_id}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          if (statusData.reel_status === "ready") {
            setReelStatus("ready");
            setReelVideoUrl(statusData.reel_video ?? null);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (statusData.reel_status === "error") {
            setReelStatus("error");
            setGenerationError(statusData.error || "Reel generation failed");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (_) {}
      }, 3000);

    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsGeneratingPipeline(false);
    }
  };

  const handleFileReplace = (
    file: File,
    setter: (f: File) => void,
    previewSetter: (url: string) => void
  ) => {
    setter(file);
    previewSetter(URL.createObjectURL(file));
  };

  const handleRegenerateReel = async () => {
    if (!pipelineResult) return;
    setIsRegeneratingReel(true);
    setReelStatus("pending");
    setReelVideoUrl(null);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const fd = new FormData();

      // Fetch stereogram as blob — resolveAssetUrl handles both Supabase and local URLs
      const stereoRes = await fetch(resolveAssetUrl(pipelineResult.stereogram_image));
      fd.append("stereogram_file", await stereoRes.blob(), "stereogram.png");

      if (customDepthMap) {
        fd.append("depth_map_file", customDepthMap, customDepthMap.name);
      } else {
        const depthRes = await fetch(resolveAssetUrl(pipelineResult.depth_map_image));
        fd.append("depth_map_file", await depthRes.blob(), "depth_map.png");
      }

      if (customPattern) {
        fd.append("pattern_file", customPattern, customPattern.name);
      } else {
        const patRes = await fetch(resolveAssetUrl(pipelineResult.pattern_image));
        fd.append("pattern_file", await patRes.blob(), "pattern.png");
      }

      const subject = (pipelineContentType === "impossible_object"
        ? pipelineForm.background_pattern
        : pipelineForm.hidden_object) || "object";
      fd.append("hook_text", `Can you see the hidden ${subject}`);
      fd.append("instruction_text", `Stare through the screen to see the ${subject}`);
      fd.append("cta_text", `Did you see the ${subject}`);

      const res = await fetch(`${BASE}/api/generate/reel-only`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Reel regeneration failed");
      const { job_id } = await res.json();

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BASE}/api/generate/status/${job_id}`);
          if (!statusRes.ok) return;
          const data = await statusRes.json();
          if (data.reel_status === "ready") {
            setReelStatus("ready");
            setReelVideoUrl(data.reel_video ?? null);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (data.reel_status === "error") {
            setReelStatus("error");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (_) {}
      }, 3000);
    } catch (e) {
      setReelStatus("error");
    } finally {
      setIsRegeneratingReel(false);
    }
  };

  const copyCaption = (caption: string) => {
    navigator.clipboard.writeText(caption).then(() => {
      alert("Caption copied to clipboard!");
    });
  };

  if (!stereogram && !showGeneratePipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="text-5xl mb-4">Generating</div>
        <p className="text-lg font-medium">Select an item from the queue</p>
        <p className="text-sm mt-1">Click any row to open the generator</p>
        <button
          onClick={() => setShowGeneratePipeline(true)}
          className="mt-6 px-4 py-2 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          Or generate content from scratch
        </button>
      </div>
    );
  }

  if (showGeneratePipeline) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Generate Content</h2>
          </div>
          <div className="border-t border-gray-100 mt-3" />
        </div>

        {/* Settings */}
        <div className="space-y-4 mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Content Settings
          </div>

          {/* Content type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Content type</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setPipelineContentType("stereogram");
                  setPipelineForm((p) => ({ ...p, background_pattern: "", hidden_object: "" }));
                }}
                className={`flex-1 px-3 py-2 transition-colors ${pipelineContentType === "stereogram" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Magic Eye
              </button>
              <button
                type="button"
                onClick={() => {
                  setPipelineContentType("illusion");
                  setPipelineForm((p) => ({ ...p, background_pattern: "", hidden_object: "" }));
                }}
                className={`flex-1 px-3 py-2 transition-colors ${pipelineContentType === "illusion" ? "bg-violet-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Optical Illusion
              </button>
              <button
                type="button"
                onClick={() => {
                  setPipelineContentType("impossible_object");
                  setPipelineForm((p) => ({ ...p, background_pattern: "penrose_triangle", hidden_object: "" }));
                }}
                className={`flex-1 px-3 py-2 transition-colors ${pipelineContentType === "impossible_object" ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Impossible Object
              </button>
            </div>
          </div>

          {pipelineContentType === "impossible_object" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Object type</label>
                <select
                  value={pipelineForm.background_pattern}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, background_pattern: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {IMPOSSIBLE_OBJECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color mode</label>
                <select
                  value={pipelineForm.color_mode}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, color_mode: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {COLOR_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : pipelineContentType === "illusion" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scene description</label>
                <input
                  type="text"
                  placeholder="e.g. misty forest at dawn"
                  value={pipelineForm.background_pattern}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, background_pattern: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <p className="text-xs text-gray-400 mt-1">Reference for the scene you plan to use on IllusionDiffusion</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hidden object</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={pipelineForm.hidden_object_type === "text" ? "e.g. LOVE" : "e.g. Rubber Duck"}
                    value={pipelineForm.hidden_object}
                    onChange={(e) => setPipelineForm((p) => ({ ...p, hidden_object: e.target.value }))}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button type="button" onClick={() => setPipelineForm((p) => ({ ...p, hidden_object_type: "image" }))}
                      className={`px-3 py-2 transition-colors ${pipelineForm.hidden_object_type === "image" ? "bg-violet-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      Image
                    </button>
                    <button type="button" onClick={() => setPipelineForm((p) => ({ ...p, hidden_object_type: "text" }))}
                      className={`px-3 py-2 transition-colors ${pipelineForm.hidden_object_type === "text" ? "bg-violet-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      Text
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Silhouette strength <span className="text-violet-600 font-semibold">{pipelineForm.depth_intensity.toFixed(2)}</span>
                </label>
                <input type="range" min={0.1} max={0.6} step={0.01}
                  value={pipelineForm.depth_intensity}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, depth_intensity: parseFloat(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Subtle</span><span>Strong</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background pattern</label>
                <input
                  type="text"
                  placeholder="e.g. Confetti Explosion"
                  value={pipelineForm.background_pattern}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, background_pattern: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hidden object</label>
                <select
                  value={pipelineForm.hidden_object}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, hidden_object: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="" disabled>Select a shape…</option>
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Depth intensity <span className="text-indigo-600 font-semibold">{pipelineForm.depth_intensity.toFixed(2)}</span>
                  </label>
                  <input type="range" min={0.1} max={0.6} step={0.01}
                    value={pipelineForm.depth_intensity}
                    onChange={(e) => setPipelineForm((p) => ({ ...p, depth_intensity: parseFloat(e.target.value) }))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dot density <span className="text-indigo-600 font-semibold">{pipelineForm.dot_density}</span>
                  </label>
                  <input type="range" min={1} max={10} step={1}
                    value={pipelineForm.dot_density}
                    onChange={(e) => setPipelineForm((p) => ({ ...p, dot_density: parseInt(e.target.value) }))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color mode</label>
                <select
                  value={pipelineForm.color_mode}
                  onChange={(e) => setPipelineForm((p) => ({ ...p, color_mode: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {COLOR_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color Palette</label>
            <select
              value={selectedPalette}
              onChange={(e) => setSelectedPalette(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {PALETTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateAll}
            disabled={isGeneratingPipeline}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 ${pipelineContentType === "impossible_object" ? "bg-amber-500 hover:bg-amber-600" : pipelineContentType === "illusion" ? "bg-violet-600 hover:bg-violet-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
          >
            {isGeneratingPipeline ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              "Generate All"
            )}
          </button>

          {generationError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              Error: {generationError}
            </div>
          )}
        </div>

        {/* Results */}
        {pipelineResult && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Generated Assets
            </div>

            {/* Image grid: Stereogram + Depth Map + Pattern + Thumbnail */}
            <div className="grid grid-cols-2 gap-3">
              {/* Stereogram */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-1">Stereogram</h3>
                <img
                  src={resolveAssetUrl(pipelineResult.stereogram_image)}
                  alt="Stereogram"
                  className="w-full rounded-lg border border-gray-200 aspect-square object-cover"
                />
              </div>

              {/* Depth Map — replaceable */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-gray-600">Depth Map</h3>
                  <label className="text-xs text-indigo-600 cursor-pointer hover:underline">
                    Replace
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) handleFileReplace(e.target.files[0], setCustomDepthMap, setCustomDepthMapPreview);
                    }} />
                  </label>
                </div>
                <img
                  src={customDepthMapPreview ?? resolveAssetUrl(pipelineResult.depth_map_image)}
                  alt="Depth Map"
                  className={`w-full rounded-lg border aspect-square object-cover ${customDepthMapPreview ? "border-indigo-400" : "border-gray-200"}`}
                />
              </div>

              {/* Pattern — replaceable */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-gray-600">Pattern</h3>
                  <label className="text-xs text-indigo-600 cursor-pointer hover:underline">
                    Replace
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) handleFileReplace(e.target.files[0], setCustomPattern, setCustomPatternPreview);
                    }} />
                  </label>
                </div>
                <img
                  src={customPatternPreview ?? resolveAssetUrl(pipelineResult.pattern_image)}
                  alt="Pattern"
                  className={`w-full rounded-lg border aspect-square object-cover ${customPatternPreview ? "border-indigo-400" : "border-gray-200"}`}
                />
              </div>

              {/* Thumbnail */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-1">Thumbnail</h3>
                <img
                  src={resolveAssetUrl(pipelineResult.thumbnail_image)}
                  alt="Thumbnail"
                  className="w-full rounded-lg border border-gray-200 aspect-square object-cover"
                />
              </div>
            </div>

            {/* Regenerate Reel button */}
            {(customDepthMap || customPattern) && reelStatus !== "pending" && (
              <button
                onClick={handleRegenerateReel}
                disabled={isRegeneratingReel}
                className="w-full py-2 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isRegeneratingReel ? "Regenerating..." : "Regenerate Reel with New Images"}
              </button>
            )}

            {/* Reel Video */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Reel Video (20s)</h3>
              {reelStatus === "pending" && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-sm">
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Rendering video... (~15 seconds)
                </div>
              )}
              {reelStatus === "ready" && reelVideoUrl && (
                <video
                  src={resolveAssetUrl(reelVideoUrl)}
                  controls
                  className="w-full rounded-lg border border-gray-200"
                />
              )}
              {reelStatus === "error" && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  Video render failed. The stereogram and thumbnail are still available above.
                </div>
              )}
            </div>

            {/* Captions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Captions</h3>
              <div className="space-y-3">
                {Object.values(pipelineResult.caption).map((variation, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-indigo-600 mb-1">{variation.label}</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{variation.caption}</p>
                      </div>
                      <button
                        onClick={() => copyCaption(variation.caption)}
                        className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 mt-1 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 mt-6 pt-4">
          <button
            onClick={() => setShowGeneratePipeline(false)}
            className="w-full px-4 py-2 rounded-lg font-semibold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  const formData = {
    background_pattern: localForm.background_pattern ?? stereogram.background_pattern,
    hidden_object: localForm.hidden_object ?? stereogram.hidden_object,
    hidden_object_type: (localForm.hidden_object_type ?? stereogram.hidden_object_type ?? "image") as "text" | "image",
    theme: localForm.theme ?? stereogram.theme,
    depth_intensity: localForm.depth_intensity ?? stereogram.depth_intensity,
    color_mode: localForm.color_mode ?? stereogram.color_mode,
    dot_density: localForm.dot_density ?? stereogram.dot_density,
  };

  const isIllusion = (stereogram.content_type ?? "stereogram") === "illusion";
  const isImpossible = (stereogram.content_type ?? "stereogram") === "impossible_object";

  const dateStr = new Date(stereogram.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900">{stereogram.background_pattern}</h2>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            #{stereogram.id}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {dateStr}
          </span>
        </div>
        <div className="border-t border-gray-100 mt-3" />
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Generator Settings
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isIllusion ? "Scene description" : isImpossible ? "Object type" : "Background pattern"}
          </label>
          {isImpossible ? (
            <select
              value={formData.background_pattern}
              onChange={(e) => handleChange("background_pattern", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {IMPOSSIBLE_OBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={formData.background_pattern}
              onChange={(e) => handleChange("background_pattern", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          )}
          {isIllusion && (
            <p className="text-xs text-gray-400 mt-1">Reference scene for IllusionDiffusion</p>
          )}
        </div>

        {!isImpossible && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hidden object</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.hidden_object}
                onChange={(e) => handleChange("hidden_object", e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleChange("hidden_object_type", "image")}
                  className={`px-3 py-2 transition-colors ${formData.hidden_object_type === "image" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("hidden_object_type", "text")}
                  className={`px-3 py-2 transition-colors ${formData.hidden_object_type === "text" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  Text
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isIllusion
                ? "Generate will produce the silhouette — upload it to IllusionDiffusion"
                : formData.hidden_object_type === "image" ? "AI generates a silhouette of this object" : "This text appears as the hidden 3D shape"}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => handleChange("theme", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {(!isIllusion || isImpossible) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color mode</label>
            <select
              value={formData.color_mode}
              onChange={(e) => handleChange("color_mode", e.target.value)}
              className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ${isImpossible ? "focus:ring-amber-300" : "focus:ring-indigo-300"}`}
            >
              {COLOR_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {!isImpossible && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Depth intensity{" "}
              <span className="text-indigo-600 font-semibold">
                {Number(formData.depth_intensity).toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.6}
              step={0.01}
              value={formData.depth_intensity}
              onChange={(e) => handleChange("depth_intensity", parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0.1</span><span>0.6</span>
            </div>
          </div>
        )}

        {!isIllusion && !isImpossible && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dot density{" "}
              <span className="text-indigo-600 font-semibold">{formData.dot_density}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={formData.dot_density}
              onChange={(e) => handleChange("dot_density", parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1</span><span>10</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Output size</label>
          <select
            value={outputSize}
            onChange={(e) => setOutputSize(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={stereogram.status === "generated" ? handleRegenerate : handleGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : stereogram.status === "generated" ? (
            "Regenerate"
          ) : isImpossible ? (
            "Generate image"
          ) : isIllusion ? (
            "Generate silhouette"
          ) : (
            "Generate stereogram"
          )}
        </button>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reel Generation</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color Palette</label>
            <select
              value={selectedPalette}
              onChange={(e) => setSelectedPalette(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {PALETTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleGenerateAll(
              isImpossible ? formData.background_pattern : formData.hidden_object
            )}
            disabled={isGeneratingPipeline}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
          >
            {isGeneratingPipeline ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating Reel...
              </>
            ) : (
              "Generate Reel"
            )}
          </button>
        </div>
      </div>

      {/* Image preview */}
      <ImagePreview stereogram={liveData || stereogram} />

      {/* Reel pipeline results */}
      {(pipelineResult || generationError) && (
        <div className="mt-6 border-t border-gray-100 pt-4 space-y-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated Assets</div>

          {generationError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">Error: {generationError}</div>
          )}

          {pipelineResult && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 mb-1">Stereogram</h3>
                  <img src={resolveAssetUrl(pipelineResult.stereogram_image)} alt="Stereogram"
                    className="w-full rounded-lg border border-gray-200 aspect-square object-cover" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 mb-1">Depth Map</h3>
                  <img src={resolveAssetUrl(pipelineResult.depth_map_image)} alt="Depth Map"
                    className="w-full rounded-lg border border-gray-200 aspect-square object-cover" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 mb-1">Pattern</h3>
                  <img src={resolveAssetUrl(pipelineResult.pattern_image)} alt="Pattern"
                    className="w-full rounded-lg border border-gray-200 aspect-square object-cover" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 mb-1">Thumbnail</h3>
                  <img src={resolveAssetUrl(pipelineResult.thumbnail_image)} alt="Thumbnail"
                    className="w-full rounded-lg border border-gray-200 aspect-square object-cover" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Reel Video</h3>
                {reelStatus === "pending" && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-sm">
                    <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Rendering video in background...
                  </div>
                )}
                {reelStatus === "ready" && reelVideoUrl && (
                  <video src={resolveAssetUrl(reelVideoUrl)} controls
                    className="w-full rounded-lg border border-gray-200" />
                )}
                {reelStatus === "error" && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">Video render failed.</div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Captions</h3>
                <div className="space-y-2">
                  {Object.values(pipelineResult.caption).map((v, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-indigo-600 mb-1">{v.label}</p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">{v.caption}</p>
                        </div>
                        <button onClick={() => copyCaption(v.caption)}
                          className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 font-medium">
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
