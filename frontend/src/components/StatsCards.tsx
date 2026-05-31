import React from "react";

interface StatsCardsProps {
  counts: {
    total: number;
    not_started: number;
    generating: number;
    generated: number;
  };
  activeFilter: string;
  onFilter: (filter: string) => void;
}

export function StatsCards({ counts, activeFilter, onFilter }: StatsCardsProps) {
  const cards = [
    { key: "", label: "Total Items", value: counts.total, tone: "purple" },
    { key: "not_started", label: "Not Started", value: counts.not_started, tone: "" },
    { key: "generating", label: "Generating", value: counts.generating, tone: "amber" },
    { key: "generated", label: "Generated", value: counts.generated, tone: "green" },
  ];

  return (
    <>
      {cards.map((card) => (
        <button
          key={card.key}
          className={`stat ${card.tone} ${activeFilter === card.key ? "active-filter" : ""}`}
          onClick={() => onFilter(card.key)}
          style={{ textAlign: "left", font: "inherit", color: "inherit", border: "1px solid" }}
        >
          <div className="val">{card.value}</div>
          <div className="lbl">{card.label}</div>
        </button>
      ))}
    </>
  );
}
