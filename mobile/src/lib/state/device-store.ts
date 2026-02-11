import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceType = 'tablet' | 'phone';

interface DeviceState {
  // Device identity
  deviceId: string | null;
  deviceName: string | null;
  deviceType: DeviceType | null;

  // Team association
  teamId: string | null;
  teamCode: string | null;

  // Event context
  currentEventId: string | null;

  // Picture pledge settings for current event
  picturePledgeEnabled: boolean;
  currentEventOverlayId: string | null;

  // Kiosk mode
  isKioskMode: boolean;
  adminPin: string;
}

interface DeviceActions {
  setDeviceConfig: (config: Partial<DeviceState>) => void;
  setCurrentEvent: (eventId: string | null) => void;
  enterKioskMode: () => void;
  exitKioskMode: (pin: string) => boolean;
  reset: () => void;
}

const initialState: DeviceState = {
  deviceId: null,
  deviceName: null,
  deviceType: null,
  teamId: null,
  teamCode: null,
  currentEventId: null,
  picturePledgeEnabled: false,
  currentEventOverlayId: null,
  isKioskMode: false,
  adminPin: '1234',
};

export const useDeviceStore = create<DeviceState & DeviceActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDeviceConfig: (config) => {
        set((state) => ({
          ...state,
          ...config,
        }));
      },

      setCurrentEvent: (eventId) => {
        set({ currentEventId: eventId });
      },

      enterKioskMode: () => {
        set({ isKioskMode: true });
      },

      exitKioskMode: (pin) => {
        const correctPin = get().adminPin;
        if (pin === correctPin) {
          set({ isKioskMode: false });
          return true;
        }
        return false;
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'device-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields
      partialize: (state) => ({
        deviceId: state.deviceId,
        deviceName: state.deviceName,
        deviceType: state.deviceType,
        teamId: state.teamId,
        teamCode: state.teamCode,
        adminPin: state.adminPin,
        // Don't persist isKioskMode or currentEventId
      }),
    }
  )
);

// Selector hooks for accessing specific state slices
export const useDeviceId = () => useDeviceStore((s) => s.deviceId);
export const useDeviceType = () => useDeviceStore((s) => s.deviceType);
export const useTeamId = () => useDeviceStore((s) => s.teamId);
export const useTeamCode = () => useDeviceStore((s) => s.teamCode);
export const useCurrentEventId = () => useDeviceStore((s) => s.currentEventId);
export const useIsKioskMode = () => useDeviceStore((s) => s.isKioskMode);
export const usePicturePledgeEnabled = () => useDeviceStore((s) => s.picturePledgeEnabled);
export const useCurrentEventOverlayId = () => useDeviceStore((s) => s.currentEventOverlayId);
