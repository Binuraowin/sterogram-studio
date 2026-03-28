"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Stereogram } from "@/lib/types";
import { QueueRow } from "./QueueRow";
import { StatsCards } from "./StatsCards";

interface QueueTableProps {
  selectedId: number | null;
  onSelect: (stereogram: Stereogram) => void;
}

export function QueueTable({ selectedId, onSelect }: QueueTableProps) {
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

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

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Stereogram Studio</h1>
        <p className="text-sm text-gray-500 mt-1">The Magic Eye 3D — Content Calendar</p>
      </div>

      <StatsCards stereograms={stereograms} />

      <div className="flex gap-3 mb-4">
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
      </div>

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
    </div>
  );
}
