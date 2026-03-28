export type StereogramStatus = "not_started" | "generating" | "generated";

export interface Stereogram {
  id: number;
  background_pattern: string;
  hidden_object: string;
  hidden_object_type: "text" | "image";
  theme: string;
  post_number: number;
  scheduled_date: string; // "2026-04-01"
  status: StereogramStatus;
  image_filename: string | null;
  image_url: string | null; // "/static/stereogram_1.png"
  depth_intensity: number; // 0.1 – 0.6
  color_mode: string; // "random"|"warm"|"cool"|"festive"
  dot_density: number; // 1 – 10
  created_at: string;
  updated_at: string;
}

export interface UpdateStereogramPayload {
  background_pattern?: string;
  hidden_object?: string;
  hidden_object_type?: "text" | "image";
  theme?: string;
  depth_intensity?: number;
  color_mode?: string;
  dot_density?: number;
}

export interface CreateStereogramPayload {
  background_pattern: string;
  hidden_object: string;
  hidden_object_type?: "text" | "image";
  theme: string;
  scheduled_date: string; // "YYYY-MM-DD"
  depth_intensity?: number;
  color_mode?: string;
  dot_density?: number;
  post_number?: number;
}
