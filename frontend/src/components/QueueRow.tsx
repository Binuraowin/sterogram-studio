import React from "react";
import { Stereogram } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface QueueRowProps {
  stereogram: Stereogram;
  isSelected: boolean;
  onClick: () => void;
}

export function QueueRow({ stereogram, isSelected, onClick }: QueueRowProps) {
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected
          ? "bg-indigo-50 border-l-4 border-l-indigo-500"
          : "border-l-4 border-l-transparent"
      }`}
    >
      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{stereogram.post_number}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">
        {stereogram.background_pattern}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate">
        {stereogram.hidden_object}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(stereogram.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={stereogram.status} />
      </td>
    </tr>
  );
}
