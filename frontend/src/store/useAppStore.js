import { create } from 'zustand';
import {
  createApplication,
  getApplications,
  getResumes,
  updateApplication,
} from '../api/client';

const sortApplications = (applications) =>
  [...applications].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

const useAppStore = create((set, get) => ({
  applications: [],
  resumes: [],
  isFetchingApplications: false,
  isFetchingResumes: false,
  isSubmittingApplication: false,
  isUpdatingApplication: false,
  applicationsError: '',
  resumesError: '',
  fetchApplications: async () => {
    set({ isFetchingApplications: true, applicationsError: '' });

    try {
      const applications = await getApplications();
      set({ applications, isFetchingApplications: false });
    } catch (error) {
      set({
        isFetchingApplications: false,
        applicationsError: error.message || 'Unable to load applications.',
      });
    }
  },
  fetchResumes: async () => {
    set({ isFetchingResumes: true, resumesError: '' });

    try {
      const resumes = await getResumes();
      set({ resumes, isFetchingResumes: false });
    } catch (error) {
      set({
        isFetchingResumes: false,
        resumesError: error.message || 'Unable to load resumes.',
      });
    }
  },
  addApplication: async (payload) => {
    set({ isSubmittingApplication: true, applicationsError: '' });

    try {
      const application = await createApplication(payload);
      set((state) => ({
        applications: sortApplications([application, ...state.applications]),
        isSubmittingApplication: false,
      }));
      return application;
    } catch (error) {
      set({
        isSubmittingApplication: false,
        applicationsError: error.message || 'Unable to create application.',
      });
      throw error;
    }
  },
  updateStatus: async (id, status) => {
    set({ isUpdatingApplication: true, applicationsError: '' });

    try {
      const updated = await updateApplication(id, { status });
      set((state) => ({
        applications: sortApplications(
          state.applications.map((application) => (application.id === id ? updated : application)),
        ),
        isUpdatingApplication: false,
      }));
      return updated;
    } catch (error) {
      set({
        isUpdatingApplication: false,
        applicationsError: error.message || 'Unable to update application.',
      });
      throw error;
    }
  },
  refreshApplication: (application) => {
    set((state) => ({
      applications: sortApplications(
        state.applications.map((item) => (item.id === application.id ? application : item)),
      ),
    }));
  },
  removeApplication: (id) => {
    set((state) => ({
      applications: state.applications.filter((application) => application.id !== id),
    }));
  },
  setResumes: (resumes) => set({ resumes }),
  getApplicationById: (id) => get().applications.find((application) => application.id === id),
}));

export default useAppStore;
