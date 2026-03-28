import React from "react";
import { Stereogram } from "@/lib/types";
import { api } from "@/lib/api";

interface ImagePreviewProps {
  stereogram: Stereogram;
}

export function ImagePreview({ stereogram }: ImagePreviewProps) {
  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  const imageFullUrl = `${BASE}${stereogram.image_url}`;
  const downloadUrl = api.downloadUrl(stereogram.id);

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</div>
      <a href={imageFullUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={imageFullUrl}
          alt={`Stereogram: ${stereogram.background_pattern}`}
          className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
      <p className="text-xs text-gray-400 mt-2">
        1200 × 800px &nbsp;•&nbsp; PNG &nbsp;•&nbsp; Generated just now
      </p>
      <div className="flex gap-2 mt-3">
        <a
          href={downloadUrl}
          download
          className="flex-1 text-center text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
        >
          Download PNG
        </a>
      </div>
    </div>
  );
}
