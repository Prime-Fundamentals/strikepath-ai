export type Handedness = "right" | "left";

export interface User {
  id: number;
  email: string;
  display_name: string;
  handedness: Handedness;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Ball {
  id: number;
  user_id: number;
  manufacturer: string;
  model: string;
  weight_lb: number;
  coverstock: string;
  surface_grit: number | null;
  rg: number | null;
  differential: number | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface Recommendation {
  id?: number;
  feet_delta: number;
  target_delta: number;
  direction_label: string;
  adjustment_type: string;
  confidence: number;
  title: string;
  explanation: string;
}

export interface Shot {
  id: number;
  session_id: number;
  ball_id: number | null;
  sequence_number: number;
  game_number: number;
  frame_number: number | null;
  feet_board: number;
  laydown_board: number;
  target_board: number;
  breakpoint_board: number;
  pocket_board: number;
  speed_mph: number | null;
  rev_rate: number | null;
  axis_rotation: number | null;
  axis_tilt: number | null;
  pinfall: number;
  leave_code: string | null;
  delivery_quality: string;
  notes: string | null;
  created_at: string;
  recommendation: Recommendation | null;
}

export interface Session {
  id: number;
  user_id: number;
  center_name: string;
  lane_number: string | null;
  oil_pattern_name: string;
  oil_length_ft: number;
  status: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  shot_count: number;
}

export interface SessionDetail extends Session {
  shots: Shot[];
}

export interface Dashboard {
  active_session: Session | null;
  total_sessions: number;
  total_shots: number;
  strike_rate: number;
  pocket_rate: number;
  arsenal_count: number;
  recent_sessions: Session[];
}

export interface Analytics {
  session_id: number;
  shot_count: number;
  strike_rate: number;
  pocket_rate: number;
  average_pinfall: number;
  average_speed: number | null;
  target_accuracy: number;
  adjustment_success_rate: number;
  board_miss_average: number;
  games: Array<{ game: number; shots: number; strike_rate: number; average_pinfall: number }>;
}

export interface LaneState {
  boards: number;
  zones: number;
  friction_grid: number[][];
  paths: Array<{
    shot_id: number;
    sequence_number: number;
    pinfall: number;
    samples: Array<{ board: number; distance_ft: number }>;
  }>;
  description: string;
}

export interface ShotInput {
  ball_id: number | null;
  game_number: number;
  frame_number: number | null;
  feet_board: number;
  laydown_board: number;
  target_board: number;
  breakpoint_board: number;
  pocket_board: number;
  speed_mph: number | null;
  rev_rate: number | null;
  axis_rotation: number | null;
  axis_tilt: number | null;
  pinfall: number;
  leave_code: string | null;
  delivery_quality: string;
  notes: string | null;
}

export interface ARPoint {
  x: number;
  y: number;
  label: string;
}

export interface ARTrackingCapture {
  id: number;
  user_id: number;
  session_id: number | null;
  source_type: "camera" | "upload";
  status: "draft" | "reviewed" | "saved";
  device_label: string | null;
  calibration_points: ARPoint[];
  path_points: ARPoint[];
  derived_boards: Record<string, number>;
  media_duration_sec: number | null;
  media_key: string | null;
  notes: string | null;
  created_at: string;
}

export interface ARTrackingCaptureInput {
  session_id: number | null;
  source_type: "camera" | "upload";
  status: "draft" | "reviewed" | "saved";
  device_label: string | null;
  calibration_points: ARPoint[];
  path_points: ARPoint[];
  derived_boards: Record<string, number>;
  media_duration_sec: number | null;
  media_key: string | null;
  notes: string | null;
}
