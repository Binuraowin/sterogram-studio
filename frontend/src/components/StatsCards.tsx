import React from "react";
import { Stereogram } from "@/lib/types";

interface StatsCardsProps {
  stereograms: Stereogram[];
}

export function StatsCards({ stereograms }: StatsCardsProps) {
  const total = stereograms.length;
  const notStarted = stereograms.filter((s) => s.status === "not_started").length;
  const generated = stereograms.filter((s) => s.status === "generated").length;
  const themes = Array.from(new Set(stereograms.map((s) => s.theme)));
  const themeLabel = themes.length === 1 ? themes[0] : `${themes.length} themes`;

  const cards = [
    { label: "Total", value: total, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Not Started", value: notStarted, color: "bg-gray-50 text-gray-700 border-gray-200" },
    { label: "Generated", value: generated, color: "bg-green-50 text-green-700 border-green-200" },
    { label: "Theme", value: themeLabel, color: "bg-purple-50 text-purple-700 border-purple-200" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border p-3 ${card.color}`}>
          <div className="text-xs font-medium opacity-70">{card.label}</div>
          <div className="text-xl font-bold mt-0.5">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
