import { create } from 'zustand';

interface Org { id: string; name: string; description?: string; my_role: string; }

interface OrgState {
  orgs: Org[];
  setOrgs: (orgs: Org[]) => void;
}

export const useOrgStore = create<OrgState>()((set) => ({
  orgs: [],
  setOrgs: (orgs) => set({ orgs }),
}));
