export type Recurrence = "daily" | "weekly" | "monthly" | "yearly";

export type EventRow = {
  id: string; user_id: string; title: string; notes: string | null; location: string | null;
  start_at: string; end_at: string; all_day: boolean; recurrence: Recurrence | null;
  recurrence_until: string | null; remind_minutes: number | null; important: boolean;
  source: "chat" | "image" | "voice" | "manual"; created_at: string; updated_at: string;
};

export type Occurrence = EventRow & { occurrence_start: string; occurrence_end: string; key: string };

export type TaskRow = {
  id: string; title: string; notes: string | null; due_at: string | null;
  priority: "low" | "normal" | "high"; done_at: string | null; created_at: string;
};

export type NoteRow = { id: string; title: string; body: string; created_at: string; updated_at: string };

export type ReminderRow = {
  id: string; title: string; body: string | null; remind_at: string; recurrence: Recurrence | null;
  urgent: boolean; event_id: string | null; task_id: string | null; sent_at: string | null;
};

export type Profile = {
  id: string; display_name: string | null; assistant_name: string; timezone: string;
  morning_brief: boolean; morning_brief_time: string; feed_token: string;
};
