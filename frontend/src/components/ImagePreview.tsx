"use client";

import React, { useState } from "react";
import { Stereogram } from "@/lib/types";
import { api } from "@/lib/api";

interface CaptionVariation {
  label: string;
  caption: string;
}

interface Captions {
  variation_a: CaptionVariation;
  variation_b: CaptionVariation;
  variation_c: CaptionVariation;
}

interface ImagePreviewProps {
  stereogram: Stereogram;
}

export function ImagePreview({ stereogram }: ImagePreviewProps) {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [captions, setCaptions] = useState<Captions | null>(null);
  const [loadingCaption, setLoadingCaption] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"a" | "b" | "c">("a");
  const [copied, setCopied] = useState(false);

  if (stereogram.status === "generating") {
    return (
      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</div>
        <div
          className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 animate-pulse"
          style={{ height: 200 }}
        />
        <p className="text-xs text-gray-400 mt-2">Generating your stereogram...</p>
      </div>
    );
  }

  if (!stereogram.image_url) {
    return null;
  }

  const imageFullUrl = stereogram.image_url?.startsWith("http")
    ? stereogram.image_url
    : `${BASE}${stereogram.image_url}`;
  const downloadUrl = api.downloadUrl(stereogram.id);

  const handleGenerateCaption = async () => {
    setLoadingCaption(true);
    setCaptionError(null);
    setCaptions(null);
    try {
      const res = await api.generateCaption(stereogram.id);
      setCaptions(res.data);
      setActiveTab("a");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCaptionError(msg || "Caption generation failed.");
    } finally {
      setLoadingCaption(false);
    }
  };

  const activeCaption = captions
    ? activeTab === "a" ? captions.variation_a
    : activeTab === "b" ? captions.variation_b
    : captions.variation_c
    : null;

  const handleCopy = () => {
    if (!activeCaption) return;
    navigator.clipboard.writeText(activeCaption.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: "a" | "b" | "c"; short: string }[] = [
    { key: "a", short: "Only 1%" },
    { key: "b", short: "90s Kids" },
    { key: "c", short: "Don't Blink" },
  ];

  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</div>
      <a href={imageFullUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={imageFullUrl}
          alt={`Stereogram: ${stereogram.background_pattern}`}
          className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
      <p className="text-xs text-gray-400">
        1200 × 800px &nbsp;•&nbsp; PNG &nbsp;•&nbsp; Generated just now
      </p>

      <div className="flex gap-2">
        <a
          href={downloadUrl}
          download
          className="flex-1 text-center text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
        >
          Download PNG
        </a>
        <button
          onClick={handleGenerateCaption}
          disabled={loadingCaption}
          className="flex-1 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {loadingCaption ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Caption
            </>
          )}
        </button>
      </div>

      {captionError && (
        <div className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg">{captionError}</div>
      )}

      {captions && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-xs font-medium py-2 transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-indigo-700 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.short}
              </button>
            ))}
          </div>

          {/* Caption content */}
          <div className="p-3 bg-white">
            <p className="text-xs font-semibold text-gray-400 mb-2">{activeCaption?.label}</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {activeCaption?.caption}
            </p>
            <button
              onClick={handleCopy}
              className="mt-3 w-full text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Copy caption"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
