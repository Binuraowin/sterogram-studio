"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CreateStereogramPayload } from "@/lib/types";

interface AddItemModalProps {
  onClose: () => void;
}

const COLOR_MODE_OPTIONS = ["random", "warm", "cool", "festive"];

const defaultForm: CreateStereogramPayload = {
  background_pattern: "",
  hidden_object: "",
  hidden_object_type: "image",
  theme: "",
  scheduled_date: new Date().toISOString().slice(0, 10),
  depth_intensity: 0.35,
  color_mode: "random",
  dot_density: 5,
};

export function AddItemModal({ onClose }: AddItemModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateStereogramPayload>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CreateStereogramPayload, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createStereogram(form);
      queryClient.invalidateQueries({ queryKey: ["stereograms"] });
      onClose();
    } catch {
      setError("Failed to create item. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add Calendar Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled date *</label>
              <input
                type="date"
                required
                value={form.scheduled_date}
                onChange={(e) => set("scheduled_date", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Theme *</label>
              <input
                type="text"
                required
                placeholder="e.g. April Fools"
                value={form.theme}
                onChange={(e) => set("theme", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Background pattern *</label>
            <input
              type="text"
              required
              placeholder="e.g. Confetti Explosion"
              value={form.background_pattern}
              onChange={(e) => set("background_pattern", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hidden object *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder={form.hidden_object_type === "text" ? "e.g. GOTCHA" : "e.g. Rubber Duck"}
                value={form.hidden_object}
                onChange={(e) => set("hidden_object", e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => set("hidden_object_type", "image")}
                  className={`px-3 py-2 transition-colors ${form.hidden_object_type === "image" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => set("hidden_object_type", "text")}
                  className={`px-3 py-2 transition-colors ${form.hidden_object_type === "text" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  Text
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.hidden_object_type === "image" ? "AI generates a silhouette of this object" : "This text appears as the hidden 3D shape"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Depth intensity <span className="text-indigo-600 font-semibold">{Number(form.depth_intensity).toFixed(2)}</span>
              </label>
              <input
                type="range" min={0.1} max={0.6} step={0.01}
                value={form.depth_intensity}
                onChange={(e) => set("depth_intensity", parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Dot density <span className="text-indigo-600 font-semibold">{form.dot_density}</span>
              </label>
              <input
                type="range" min={1} max={10} step={1}
                value={form.dot_density}
                onChange={(e) => set("dot_density", parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Color mode</label>
            <select
              value={form.color_mode}
              onChange={(e) => set("color_mode", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {COLOR_MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
