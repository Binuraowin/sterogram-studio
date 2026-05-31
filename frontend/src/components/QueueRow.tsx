import React from "react";
import { Stereogram } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface QueueRowProps {
  stereogram: Stereogram;
  isSelected: boolean;
  onClick: () => void;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function QueueRow({ stereogram, isSelected, onClick }: QueueRowProps) {
  const statusClass = stereogram.status === "generating" ? "generating"
    : stereogram.status === "generated" ? "generated" : "";

  return (
    <tr
      onClick={onClick}
      className={`${statusClass} ${isSelected ? "selected" : ""}`}
      style={{ cursor: "pointer" }}
    >
      <td className="num-cell">{String(stereogram.post_number ?? stereogram.id).padStart(2, "0")}</td>
      <td>
        {stereogram.content_type === "illusion" ? (
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(139,92,246,0.15)", color: "#a78bfa", letterSpacing: "0.03em" }}>
            Illusion
          </span>
        ) : (
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", letterSpacing: "0.03em" }}>
            Magic Eye
          </span>
        )}
      </td>
      <td style={{ fontWeight: 500 }}>{stereogram.background_pattern}</td>
      <td className="text-2">{stereogram.hidden_object}</td>
      <td className="text-3 mono" style={{ fontSize: 12 }}>{fmtDate(stereogram.scheduled_date)}</td>
      <td><StatusBadge status={stereogram.status} /></td>
      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn" title="Preview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button className="iconbtn purple" title="Regenerate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 18 5.29"/>
          </svg>
        </button>
        <button className="iconbtn green" title="Download">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </td>
    </tr>
  );
}
