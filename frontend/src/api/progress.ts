import { apiClient } from "./client";

export interface Badge {
  code: string;
  label: string;
  achieved: boolean;
}

export interface Progress {
  attendance_percent: number;
  assignment_completion_percent: number;
  quiz_average_percent: number;
  badges: Badge[];
}

export function getProgress(studentId: string) {
  return apiClient.get<Progress>(`/progress/students/${studentId}`).then((res) => res.data);
}
