"use client";

import { useState } from "react";
import { QueueTable } from "@/components/QueueTable";
import { GeneratorPanel } from "@/components/GeneratorPanel";
import { Stereogram } from "@/lib/types";

export default function Home() {
  const [selectedStereogram, setSelectedStereogram] = useState<Stereogram | null>(null);

  return (
    <main className="flex h-screen overflow-hidden">
      {/* Left panel - Queue (60%) */}
      <div className="w-3/5 flex flex-col p-6 border-r border-gray-200 bg-white overflow-hidden">
        <QueueTable
          selectedId={selectedStereogram?.id ?? null}
          onSelect={setSelectedStereogram}
        />
      </div>

      {/* Right panel - Generator (40%) */}
      <div className="w-2/5 flex flex-col p-6 bg-white overflow-hidden">
        <GeneratorPanel selectedStereogram={selectedStereogram} />
      </div>
    </main>
  );
}
