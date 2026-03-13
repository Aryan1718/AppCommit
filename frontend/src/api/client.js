import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getToken = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    console.log('[Dashboard API] No session:', error?.message);
    return null;
  }

  return session.access_token;
};

export const authFetch = async (path, options = {}) => {
  const token = await getToken();

  if (!token) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.contentType === null ? {} : { 'Content-Type': options.contentType || 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    console.log('[Dashboard API] 401 - forcing token refresh');

    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      console.log('[Dashboard API] Refresh failed, redirecting to login');
      await supabase.auth.signOut();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    console.log('[Dashboard API] Token refreshed, retrying request');
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.contentType === null ? {} : { 'Content-Type': options.contentType || 'application/json' }),
        Authorization: `Bearer ${data.session.access_token}`,
        ...options.headers,
      },
    });
  }

  return response;
};

const normalizeErrorMessage = (message, fallback) => {
  if (!message) {
    return fallback;
  }

  return String(message).replace(/\b[A-Z_]{3,}\b/g, '').trim() || fallback;
};

const parseErrorResponse = async (response, fallback) => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') {
      return normalizeErrorMessage(payload.detail, fallback);
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const request = async (path, options = {}) => {
  const response = await authFetch(path, {
    ...options,
    method: options.method || 'GET',
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response, 'Request failed.'));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const mapTimelineEvent = (event) => {
  const eventData = event.event_data || {};

  if (event.event_type === 'status_change') {
    return {
      id: event.id,
      type: 'status',
      label: `Status changed to ${eventData.to || 'updated'}`,
      date: event.created_at,
    };
  }

  if (event.event_type === 'note_added') {
    return {
      id: event.id,
      type: 'note',
      label: `Added note: ${eventData.notes || 'Updated notes'}`,
      date: event.created_at,
    };
  }

  return {
    id: event.id,
    type: 'applied',
    label: 'Applied',
    date: event.created_at,
  };
};

const mapApplication = (application) => ({
  id: application.id,
  company: application.company,
  jobTitle: application.job_title,
  jobDescription: application.job_description || '',
  portal: application.portal || 'Unknown',
  resumeId: application.resume_id || '',
  resumeFilename: application.resume_filename || '',
  resumeUrl: application.resume_url || '',
  jobUrl: application.url || '',
  status: application.status,
  notes: application.notes || '',
  appliedAt: application.applied_at,
  createdAt: application.created_at,
  updatedAt: application.updated_at,
  timeline: (application.timeline || []).map(mapTimelineEvent),
});

const mapResume = (resume) => ({
  id: resume.id,
  filename: resume.filename,
  storagePath: resume.storage_path,
  mimeType: resume.mime_type,
  size: resume.size || 0,
  uploadedAt: resume.uploaded_at,
  usedIn: resume.used_in || 0,
});

export const getApplications = async () => {
  const data = await request('/api/applications');
  return data.map(mapApplication);
};

export const getApplication = async (id) => {
  const data = await request(`/api/applications/${id}`);
  return mapApplication(data);
};

export const createApplication = async (payload) => {
  const data = await request('/api/applications', {
    method: 'POST',
    body: JSON.stringify({
      company: payload.company,
      job_title: payload.jobTitle,
      job_description: payload.jobDescription || null,
      portal: payload.portal || null,
      resume_id: payload.resumeId || null,
      resume_filename: payload.resumeFilename || null,
      url: payload.jobUrl || null,
      status: payload.status || 'applied',
      notes: payload.notes || null,
      applied_at: payload.appliedAt || null,
    }),
  });
  return mapApplication(data);
};

export const updateApplication = async (id, payload) => {
  const data = await request(`/api/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    }),
  });
  return mapApplication(data);
};

export const deleteApplication = async (id) => {
  await request(`/api/applications/${id}`, {
    method: 'DELETE',
    contentType: null,
  });
  return { success: true };
};

export const getResumes = async () => {
  const data = await request('/api/resumes');
  return data.map(mapResume);
};

export const uploadResume = async (base64payload, file) => {
  const data = await request('/api/resumes/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      mimetype: file.type || 'application/pdf',
      size: file.size,
      base64: base64payload,
    }),
  });
  return mapResume(data);
};

export const downloadResume = async (id) => {
  const data = await request(`/api/resumes/${id}/download`);
  return {
    resumeId: data.resume_id,
    filename: data.filename,
    signedUrl: data.signed_url,
    expiresIn: data.expires_in,
  };
};

export const deleteResume = async (id, force = false) => {
  await request(`/api/resumes/${id}?force=${force ? 'true' : 'false'}`, {
    method: 'DELETE',
    contentType: null,
  });
  return { success: true };
};
