// store/agentStore.ts — Estado global del agente con Zustand
import { create } from 'zustand';

export type AgentAvailability = 'available' | 'busy' | 'away' | 'offline';

interface AgentProfile {
  uid: string;
  name: string;
  email: string;
  extension: string;   // Ej: '8001'
  sipPassword: string;
}

interface AgentStore {
  profile: AgentProfile | null;
  availability: AgentAvailability;
  activeCallId: string | null;

  setProfile: (p: AgentProfile) => void;
  setAvailability: (a: AgentAvailability) => void;
  setActiveCall: (callId: string | null) => void;
  clearProfile: () => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  profile:       null,
  availability:  'offline',
  activeCallId:  null,

  setProfile:      (profile)      => set({ profile, availability: 'available' }),
  setAvailability: (availability) => set({ availability }),
  setActiveCall:   (activeCallId) => set({ activeCallId }),
  clearProfile:    ()             => set({ profile: null, availability: 'offline', activeCallId: null }),
}));
