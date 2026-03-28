"use client";

import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram } from "@/lib/types";
import { QueueRow } from "./QueueRow";
import { StatsCards } from "./StatsCards";
import { AddItemModal } from "./AddItemModal";

interface QueueTableProps {
  selectedId: number | null;
  onSelect: (stereogram: Stereogram) => void;
}

export function QueueTable({ selectedId, onSelect }: QueueTableProps) {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery<Stereogram[]>({
    queryKey: ["stereograms", dateFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.listStereograms(params);
      return res.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      const hasGenerating = (data as Stereogram[]).some((s) => s.status === "generating");
      return hasGenerating ? 2000 : false;
    },
  });

  const stereograms = data || [];

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
      // reset so the same file can be re-uploaded
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  // CSV template download
  const handleDownloadTemplate = () => {
    const headers = "scheduled_date,background_pattern,hidden_object,theme,depth_intensity,color_mode,dot_density";
    const example = "2026-04-10,Polka Dot Swirl,Rainbow Unicorn,Spring,0.35,random,5";
    const blob = new Blob([`${headers}\n${example}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stereogram-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Stereogram Studio</h1>
        <p className="text-sm text-gray-500 mt-1">The Magic Eye 3D — Content Calendar</p>
      </div>

      <StatsCards stereograms={stereograms} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All dates</option>
          <option value="2026-04-01">Apr 1, 2026</option>
          <option value="2026-04-02">Apr 2, 2026</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="generating">Generating</option>
          <option value="generated">Generated</option>
        </select>

        <div className="flex-1" />

        {/* Import CSV */}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCSVChange}
        />
        <button
          onClick={handleDownloadTemplate}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          CSV template
        </button>
        <button
          onClick={() => csvInputRef.current?.click()}
          disabled={importing}
          className="text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {importing ? "Importing..." : "Import CSV"}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add item
        </button>
      </div>

      {/* Import feedback */}
      {importResult && (
        <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${importResult.includes("failed") || importResult.includes("errors") ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pattern</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Hidden Object</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
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
      </div>

      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
