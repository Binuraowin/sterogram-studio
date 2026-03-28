"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram, UpdateStereogramPayload } from "@/lib/types";
import { ImagePreview } from "./ImagePreview";

interface GeneratorPanelProps {
  selectedStereogram: Stereogram | null;
}

const SIZE_OPTIONS = [
  { label: "800 × 600", value: "800x600" },
  { label: "1200 × 800", value: "1200x800" },
  { label: "1920 × 1080", value: "1920x1080" },
];

const COLOR_MODE_OPTIONS = [
  { label: "Random", value: "random" },
  { label: "Warm", value: "warm" },
  { label: "Cool", value: "cool" },
  { label: "Festive", value: "festive" },
];

export function GeneratorPanel({ selectedStereogram }: GeneratorPanelProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputSize, setOutputSize] = useState("1200x800");
  const [localForm, setLocalForm] = useState<UpdateStereogramPayload>({});
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

  if (!stereogram) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="text-5xl mb-4">🔮</div>
        <p className="text-lg font-medium">Select an item from the queue</p>
        <p className="text-sm mt-1">Click any row to open the generator</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Background pattern</label>
          <input
            type="text"
            value={formData.background_pattern}
            onChange={(e) => handleChange("background_pattern", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

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
            {formData.hidden_object_type === "image" ? "AI generates a silhouette of this object" : "This text appears as the hidden 3D shape"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => handleChange("theme", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color mode</label>
          <select
            value={formData.color_mode}
            onChange={(e) => handleChange("color_mode", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {COLOR_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

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
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </>
          ) : stereogram.status === "generated" ? (
            "Regenerate"
          ) : (
            "Generate stereogram"
          )}
        </button>
      </div>

      {/* Image preview */}
      <ImagePreview stereogram={liveData || stereogram} />
    </div>
  );
}
