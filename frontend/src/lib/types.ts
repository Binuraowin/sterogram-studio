export type StereogramStatus = "not_started" | "generating" | "generated";

export interface Stereogram {
  id: number;
  background_pattern: string;
  hidden_object: string;
  hidden_object_type: "text" | "image";
  content_type: "stereogram" | "illusion" | "impossible_object";
  theme: string;
  post_number: number;
  scheduled_date: string; // "2026-04-01"
  status: StereogramStatus;
  image_filename: string | null;
  image_url: string | null; // "/static/stereogram_1.png"
  depth_map_url: string | null;
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
  content_type?: "stereogram" | "illusion" | "impossible_object";
  theme?: string;
  depth_intensity?: number;
  color_mode?: string;
  dot_density?: number;
}

export interface PipelineResult {
  job_id: string;
  stereogram_image: string;
  depth_map_image: string;
  pattern_image: string;
  thumbnail_image: string;
  reel_video: string | null;
  reel_status: string;
  caption: Record<string, { label: string; caption: string }>;
}

export interface PostPreview {
  title: string;
  content: string;
  date: string;
  tags: string[];
  stereogram_count: number;
  wordpress_configured: boolean;
}

export interface CreateStereogramPayload {
  background_pattern: string;
  hidden_object: string;
  hidden_object_type?: "text" | "image";
  content_type?: "stereogram" | "illusion" | "impossible_object";
  theme: string;
  scheduled_date: string; // "YYYY-MM-DD"
  depth_intensity?: number;
  color_mode?: string;
  dot_density?: number;
  post_number?: number;
}
