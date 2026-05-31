"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram } from "@/lib/types";
import { QueueRow } from "./QueueRow";
import { StatsCards } from "./StatsCards";
import { AddItemModal } from "./AddItemModal";
import { GeneratePostModal } from "./GeneratePostModal";

interface QueueTableProps {
  selectedId: number | null;
  onSelect: (stereogram: Stereogram) => void;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function QueueTable({ selectedId, onSelect }: QueueTableProps) {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery<Stereogram[]>({
    queryKey: ["stereograms"],
    queryFn: async () => (await api.listStereograms({})).data,
    refetchInterval: (query) => {
      const rows = query.state.data as Stereogram[] | undefined;
      return rows?.some((s) => s.status === "generating") ? 2000 : false;
    },
  });

  const allStereograms = data || [];

  const stereograms = allStereograms.filter((s) => {
    if (dateFilter && s.scheduled_date !== dateFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (searchQuery && !`${s.background_pattern} ${s.hidden_object}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const uniqueDates = Array.from(new Set(allStereograms.map((s) => s.scheduled_date))).sort();

  const dateItems = dateFilter ? allStereograms.filter((s) => s.scheduled_date === dateFilter) : [];
  const selectedForDate = selectedId ? allStereograms.find(s => s.id === selectedId) : null;
  const targetDate = dateFilter || selectedForDate?.scheduled_date;
  const itemsForTargetDate = targetDate ? allStereograms.filter(s => s.scheduled_date === targetDate) : [];
  const allGenerated = itemsForTargetDate.length > 0 && itemsForTargetDate.every(s => s.status === "generated");

  const handleCSVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.importCSV(formData);
      const { imported, errors } = res.data;
      setImportResult(
        errors.length > 0
          ? `Imported ${imported} items. ${errors.length} row(s) had errors.`
          : `Successfully imported ${imported} items.`
      );
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
    } catch {
      setImportResult("CSV import failed. Check your file format.");
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "scheduled_date,background_pattern,hidden_object,hidden_object_type,theme,depth_intensity,color_mode,dot_density";
    const example = "2026-04-10,Polka Dot Swirl,Rainbow Unicorn,image,Spring,0.35,random,5";
    const blob = new Blob([`${headers}\n${example}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stereogram-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = {
    total: allStereograms.length,
    not_started: allStereograms.filter(s => s.status === "not_started").length,
    generating: allStereograms.filter(s => s.status === "generating").length,
    generated: allStereograms.filter(s => s.status === "generated").length,
  };

  return (
    <>
      {/* Top bar */}
      <div className="topbar">
        <span className="logo-mark" />
        <div style={{ flex: 1 }}>
          <h1>Stereogram Studio</h1>
          <p>The Magic Eye 3D — Content Calendar</p>
        </div>
        <Link href="/rescue-reel" className="nav-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="11" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="11" r="2"/>
            <path d="M12 12c-3 0-6 3-6 6 0 2 2 3 4 3 1 0 1-1 2-1s1 1 2 1c2 0 4-1 4-3 0-3-3-6-6-6z"/>
          </svg>
          Rescue Reel Generator
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>

      {/* Stats filter chips */}
      <div className="stats">
        <StatsCards
          counts={counts}
          activeFilter={statusFilter}
          onFilter={(f) => setStatusFilter(prev => prev === f ? "" : f)}
        />
      </div>

      {/* Filter bar */}
      <div className="filters">
        {/* Date select */}
        <div className="select-wrap">
          <select
            className="ds-select"
            style={{ width: 140 }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="">All Dates</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>{fmtDate(d)}</option>
            ))}
          </select>
          <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Status select */}
        <div className="select-wrap">
          <select
            className="ds-select"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="generating">Generating</option>
            <option value="generated">Generated</option>
          </select>
          <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Search */}
        <div className="ds-search" style={{ flex: 1, maxWidth: 240 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search pattern or object…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Download template */}
        <button className="iconlink" onClick={handleDownloadTemplate} style={{ fontSize: 12.5, gap: 5, background: "none", border: "none" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Template
        </button>

        {/* Import CSV */}
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVChange} />
        <button
          className="btn outline sm"
          onClick={() => csvInputRef.current?.click()}
          disabled={importing}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {importing ? "Importing…" : "Import CSV"}
        </button>

        {/* Add Item */}
        <button className="btn primary sm" onClick={() => setShowAddModal(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Item
        </button>
      </div>

      {importResult && (
        <div
          className="error-banner"
          style={{
            margin: "0 24px 8px",
            background: importResult.includes("failed") || importResult.includes("errors") ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
            borderColor: importResult.includes("failed") ? "rgba(217,119,6,0.35)" : "rgba(22,163,74,0.35)",
            color: importResult.includes("failed") ? "#fbbf24" : "#4ade80",
          }}
        >
          <span>{importResult}</span>
          <button className="iconbtn" onClick={() => setImportResult(null)} style={{ marginLeft: "auto" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        {allStereograms.length === 0 ? (
          <div className="ds-empty" style={{ padding: "60px 40px" }}>
            <div className="icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: 16, fontWeight: 600 }}>Your queue is empty</h3>
            <p style={{ margin: 0, maxWidth: 360 }}>
              Add your first stereogram item or import a CSV to schedule content for The Magic Eye 3D.
            </p>
            <div className="btn-row" style={{ marginTop: 6 }}>
              <button className="btn primary" onClick={() => setShowAddModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Item
              </button>
              <button className="btn outline" onClick={() => csvInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import CSV
              </button>
            </div>
          </div>
        ) : stereograms.length === 0 ? (
          <div className="ds-empty" style={{ padding: "50px 40px" }}>
            <div className="icon" style={{ background: "transparent", border: "1px dashed var(--border-2)", color: "var(--text-3)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: 15, fontWeight: 600 }}>No items match your filters</h3>
            <button className="btn ghost" onClick={() => { setStatusFilter(""); setDateFilter(""); setSearchQuery(""); }}>Clear filters</button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Pattern</th>
                <th>Hidden Object</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stereograms.map((s) => (
                <QueueRow
                  key={s.id}
                  stereogram={s}
                  isSelected={s.id === selectedId}
                  onClick={() => onSelect(s)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom bar — Generate Post */}
      {allGenerated && targetDate && (
        <div className="bottom-bar">
          <div className="text-3" style={{ fontSize: 12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 6 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            All items for <strong className="text-2">{fmtDate(targetDate)}</strong> are generated
          </div>
          <button className="btn success" onClick={() => setShowPostModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Generate Post
          </button>
        </div>
      )}

      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} />}
      {showPostModal && (
        <GeneratePostModal
          defaultDate={dateFilter}
          stereogramsForDate={dateItems}
          onClose={() => setShowPostModal(false)}
        />
      )}
    </>
  );
}
