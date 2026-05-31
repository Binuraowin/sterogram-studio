"use client";

import { useState } from "react";
import Link from "next/link";
import { QueueTable } from "@/components/QueueTable";
import { GeneratorPanel } from "@/components/GeneratorPanel";
import { Stereogram } from "@/lib/types";

export default function Home() {
  const [selectedStereogram, setSelectedStereogram] = useState<Stereogram | null>(null);

  return (
    <div className="dash fade-enter">
      {/* Left 60% — Queue */}
      <div className="left">
        <QueueTable
          selectedId={selectedStereogram?.id ?? null}
          onSelect={setSelectedStereogram}
        />
      </div>

      {/* Right 40% — Generator */}
      <div className="right">
        {selectedStereogram ? (
          <div className="right-inner">
            <GeneratorPanel selectedStereogram={selectedStereogram} />
          </div>
        ) : (
          <div className="right-empty">
            <div className="ds-empty">
              <div className="icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3z"/>
                  <path d="M5 21l.7-1.7L7.4 18.6l-1.7-.7L5 16l-.7 1.9L2.6 18.6l1.7.7L5 21z"/>
                </svg>
              </div>
              <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                Select an item from the queue
              </h3>
              <p style={{ margin: 0, maxWidth: 280 }}>
                Pick a row to edit its parameters and generate the stereogram + caption set.
              </p>
              <Link href="/rescue-reel" className="btn primary" style={{ marginTop: 4, textDecoration: "none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="11" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="11" r="2"/>
                  <path d="M12 12c-3 0-6 3-6 6 0 2 2 3 4 3 1 0 1-1 2-1s1 1 2 1c2 0 4-1 4-3 0-3-3-6-6-6z"/>
                </svg>
                Open Rescue Reel Generator
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
