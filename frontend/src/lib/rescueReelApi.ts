import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface RescuePrompts {
  image_prompts: [string, string, string];
  video_prompts: [string, string];
  caption: string;
}

export interface GenerateImagesResponse {
  image_urls: [string, string, string];
}

export interface GenerateVideosResponse {
  task_id_1: string;
  task_id_2: string;
}

export interface VideoStatusResponse {
  state: "generating" | "success" | "failed";
  video_url: string | null;
  error: string | null;
}

export interface MergeVideosResponse {
  video_url: string;
  filename: string;
}

export type ReelStyle = "cctv" | "natural";

export interface ReelSession {
  id: number;
  scene: string;
  style: ReelStyle;
  status: string;
  image_prompts: [string, string, string] | null;
  video_prompts: [string, string] | null;
  caption: string | null;
  image_urls: [string, string, string] | null;
  video_url_1: string | null;
  video_url_2: string | null;
  final_video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveSessionPayload {
  id?: number;
  scene: string;
  style: ReelStyle;
  status: string;
  image_prompts?: string[] | null;
  video_prompts?: string[] | null;
  caption?: string | null;
  image_urls?: string[] | null;
  video_url_1?: string | null;
  video_url_2?: string | null;
  final_video_url?: string | null;
}

export const rescueReelApi = {
  generatePrompts: (scene: string, style: ReelStyle) =>
    axios.post<RescuePrompts>(`${BASE}/api/rescue-reel/generate-prompts`, { scene, style }),

  generateImages: (image_prompts: string[]) =>
    axios.post<GenerateImagesResponse>(`${BASE}/api/rescue-reel/generate-images`, { image_prompts }),

  generateVideos: (image_urls: string[], video_prompts: string[]) =>
    axios.post<GenerateVideosResponse>(`${BASE}/api/rescue-reel/generate-videos`, {
      image_urls,
      video_prompts,
    }),

  generateSingleVideo: (image_url_start: string, image_url_end: string, video_prompt: string) =>
    axios.post<{ task_id: string }>(`${BASE}/api/rescue-reel/generate-video-single`, {
      image_url_start,
      image_url_end,
      video_prompt,
    }),

  getVideoStatus: (task_id: string) =>
    axios.get<VideoStatusResponse>(`${BASE}/api/rescue-reel/video-status/${task_id}`),

  mergeVideos: (video_url_1: string, video_url_2: string) =>
    axios.post<MergeVideosResponse>(`${BASE}/api/rescue-reel/merge-videos`, {
      video_url_1,
      video_url_2,
    }),

  regeneratePrompt: (scene: string, style: ReelStyle, prompt_type: string, current_prompts: object) =>
    axios.post<{ value: string }>(`${BASE}/api/rescue-reel/regenerate-prompt`, {
      scene,
      style,
      prompt_type,
      current_prompts,
    }),

  listSessions: () =>
    axios.get<ReelSession[]>(`${BASE}/api/rescue-reel/sessions`),

  getSession: (id: number) =>
    axios.get<ReelSession>(`${BASE}/api/rescue-reel/sessions/${id}`),

  saveSession: (payload: SaveSessionPayload) =>
    axios.post<ReelSession>(`${BASE}/api/rescue-reel/sessions`, payload),

  deleteSession: (id: number) =>
    axios.delete(`${BASE}/api/rescue-reel/sessions/${id}`),

  regenerateImage: (prompt: string, index: number, referenceUrl?: string | null) =>
    axios.post<{ image_url: string }>(`${BASE}/api/rescue-reel/regenerate-image`, {
      prompt,
      index,
      reference_url: referenceUrl ?? null,
    }),
};
