import { apiClient } from "./client";

export type ResourceType = "link" | "document";

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  external_url: string | null;
  file_url: string | null;
  class_grade_id: string | null;
  subject_id: string | null;
  category: string | null;
  uploaded_by_user_id: string;
}

export interface ResourceCreatePayload {
  title: string;
  description?: string;
  resource_type: ResourceType;
  external_url?: string;
  file_url?: string;
  class_grade_id?: string;
  subject_id?: string;
  category?: string;
}

export function listResources(filters?: { classGradeId?: string; subjectId?: string; category?: string }) {
  const params = {
    class_grade_id: filters?.classGradeId || undefined,
    subject_id: filters?.subjectId || undefined,
    category: filters?.category || undefined,
  };
  return apiClient.get<Resource[]>("/resources", { params }).then((res) => res.data);
}

export function createResource(payload: ResourceCreatePayload) {
  return apiClient.post<Resource>("/resources", payload).then((res) => res.data);
}

export function deleteResource(resourceId: string) {
  return apiClient.delete(`/resources/${resourceId}`);
}
