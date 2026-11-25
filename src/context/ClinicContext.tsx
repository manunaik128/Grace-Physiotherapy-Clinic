import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AdminProfile,
  BlockedDate,
  ClinicSettings,
  GalleryImage,
  PatientProfile,
  Service,
  TeamMember,
  Testimonial,
  WorkingHour,
} from '../types/clinic';

interface PublicClinicBundle {
  settings: ClinicSettings;
  workingHours: WorkingHour[];
  blockedDates: BlockedDate[];
  services: Service[];
  testimonials: Testimonial[];
  gallery: GalleryImage[];
  team: TeamMember[];
  todayIST: string;
  mapsApiKey: string;
}

interface ClinicContextValue {
  data: PublicClinicBundle | null;
  loading: boolean;
  error: string | null;
  refreshClinicData: () => Promise<void>;
  adminToken: string | null;
  adminUser: AdminProfile | null;
  setAdminSession: (token: string, user: AdminProfile) => void;
  clearAdminSession: () => void;
  patientToken: string | null;
  patientUser: PatientProfile | null;
  setPatientSession: (token: string, user: PatientProfile) => void;
  clearPatientSession: () => void;
}

const ClinicContext = createContext<ClinicContextValue | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PublicClinicBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin & Patient Bearer tokens are held strictly in React memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminProfile | null>(null);
  const [patientToken, setPatientToken] = useState<string | null>(null);
  const [patientUser, setPatientUser] = useState<PatientProfile | null>(null);

  const refreshClinicData = useCallback(async () => {
    try {
      const res = await fetch('/api/clinic/public');
      if (!res.ok) {
        throw new Error('Failed to load clinic information.');
      }
      const json = (await res.json()) as PublicClinicBundle;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach clinic server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshClinicData();
  }, [refreshClinicData]);

  const setAdminSession = useCallback((token: string, user: AdminProfile) => {
    setAdminToken(token);
    setAdminUser(user);
  }, []);

  const clearAdminSession = useCallback(() => {
    setAdminToken(null);
    setAdminUser(null);
  }, []);

  const setPatientSession = useCallback((token: string, user: PatientProfile) => {
    setPatientToken(token);
    setPatientUser(user);
  }, []);

  const clearPatientSession = useCallback(() => {
    setPatientToken(null);
    setPatientUser(null);
  }, []);

  return (
    <ClinicContext.Provider
      value={{
        data,
        loading,
        error,
        refreshClinicData,
        adminToken,
        adminUser,
        setAdminSession,
        clearAdminSession,
        patientToken,
        patientUser,
        setPatientSession,
        clearPatientSession,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) {
    throw new Error('useClinic must be used inside ClinicProvider');
  }
  return ctx;
}
