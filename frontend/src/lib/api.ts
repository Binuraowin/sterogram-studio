import axios from "axios";
import { UpdateStereogramPayload, CreateStereogramPayload } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const api = {
  listStereograms: (params?: { date?: string; status?: string }) =>
    axios.get(`${BASE}/api/stereograms`, { params }),
  getStereogram: (id: number) =>
    axios.get(`${BASE}/api/stereograms/${id}`),
  updateStereogram: (id: number, data: UpdateStereogramPayload) =>
    axios.put(`${BASE}/api/stereograms/${id}`, data),
  generateStereogram: (id: number) =>
    axios.post(`${BASE}/api/stereograms/${id}/generate`),
  regenerateStereogram: (id: number) =>
    axios.post(`${BASE}/api/stereograms/${id}/regenerate`),
  downloadUrl: (id: number) => `${BASE}/api/stereograms/${id}/download`,
  createStereogram: (data: CreateStereogramPayload) =>
    axios.post(`${BASE}/api/stereograms`, data),
  importCSV: (formData: FormData) =>
    axios.post(`${BASE}/api/stereograms/import/csv`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  generateCaption: (id: number) =>
    axios.post(`${BASE}/api/stereograms/${id}/caption`),
  previewPost: (date: string, stereogramIds?: number[]) =>
    axios.post(`${BASE}/api/posts/preview`, { date, stereogram_ids: stereogramIds }),
  publishPost: (date: string, status: "draft" | "publish", stereogramIds?: number[]) =>
    axios.post(`${BASE}/api/posts/publish`, { date, status, stereogram_ids: stereogramIds }),
};
