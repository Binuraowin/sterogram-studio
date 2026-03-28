"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { PostPreview, Stereogram } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GeneratePostModalProps {
  onClose: () => void;
  defaultDate: string;
  stereogramsForDate: Stereogram[];
}

export function GeneratePostModal({ onClose, defaultDate, stereogramsForDate }: GeneratePostModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(stereogramsForDate.filter((s) => s.status === "generated").map((s) => s.id))
  );
  const [preview, setPreview] = useState<PostPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ url: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setPublishResult(null);
    try {
      const res = await api.previewPost(defaultDate, Array.from(selectedIds));
      setPreview(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to generate post preview.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async (status: "draft" | "publish") => {
    if (!preview) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await api.publishPost(defaultDate, status, Array.from(selectedIds));
      setPublishResult({ url: res.data.wp_post_url, id: res.data.wp_post_id });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "WordPress publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const dateLabel = new Date(defaultDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Generate WordPress Post</h2>
            <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Stereogram selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Select stereograms to include
              </p>
              <div className="flex gap-2 text-xs text-indigo-600">
                <button onClick={() => { setSelectedIds(new Set(stereogramsForDate.filter(s => s.status === "generated").map(s => s.id))); setPreview(null); }} className="hover:underline">All generated</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => { setSelectedIds(new Set()); setPreview(null); }} className="hover:underline">None</button>
              </div>
            </div>
            <div className="space-y-2">
              {stereogramsForDate.map((s, i) => {
                const isGenerated = s.status === "generated";
                const isSelected = selectedIds.has(s.id);
                const imageUrl = s.image_url
                  ? s.image_url.startsWith("http") ? s.image_url : `${BASE}${s.image_url}`
                  : null;

                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${!isGenerated ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isGenerated}
                      onChange={() => isGenerated && toggleId(s.id)}
                      className="accent-indigo-600 w-4 h-4 flex-shrink-0"
                    />
                    {/* Thumbnail */}
                    <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt={s.hidden_object} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        #{i + 1} — {s.hidden_object}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{s.background_pattern}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      isGenerated ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isGenerated ? "Generated" : s.status}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={loading || selectedIds.size === 0}
            className="w-full py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Generating preview..." : `Preview post (${selectedIds.size} stereogram${selectedIds.size !== 1 ? "s" : ""})`}
          </button>

          {/* Error */}
          {error && (
            <div className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Publish success */}
          {publishResult && (
            <div className="text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg flex items-center gap-2">
              <span>Published! WordPress post ID: <strong>#{publishResult.id}</strong></span>
              {publishResult.url && (
                <a href={publishResult.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">View post →</a>
              )}
            </div>
          )}

          {/* Preview result */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Post title</p>
                  <p className="text-sm font-semibold text-gray-900">{preview.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{preview.stereogram_count} stereogram{preview.stereogram_count !== 1 ? "s" : ""} · {preview.date}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  <button
                    onClick={handleCopy}
                    className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy HTML"}
                  </button>
                  {preview.wordpress_configured ? (
                    <>
                      <button
                        onClick={() => handlePublish("draft")}
                        disabled={publishing}
                        className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {publishing ? "..." : "Save draft"}
                      </button>
                      <button
                        onClick={() => handlePublish("publish")}
                        disabled={publishing}
                        className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-60"
                      >
                        {publishing ? "Publishing..." : "Publish"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 py-1.5 max-w-48 text-right">
                      Add WP_URL, WP_USER, WP_APP_PASSWORD to .env to publish directly
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {preview.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Rendered preview</p>
                <div
                  className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-white overflow-auto max-h-80"
                  dangerouslySetInnerHTML={{ __html: preview.content }}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">HTML source</p>
                <div className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all text-gray-700">
                  {preview.content}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
