import React from "react";
import { StereogramStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: StereogramStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "generating") {
    return (
      <span className="badge amber">
        <span className="dot" />
        Generating
      </span>
    );
  }
  if (status === "generated") {
    return (
      <span className="badge green">
        <span className="dot" />
        Generated
      </span>
    );
  }
  return <span className="badge gray">Not Started</span>;
}
