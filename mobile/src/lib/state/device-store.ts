import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceType = 'tablet' | 'phone';
export type CodeType = 'tablet' | 'phone';

interface DeviceState {
  // Device identity
  deviceId: string | null;
  deviceName: string | null;
  deviceType: DeviceType | null;

  // Team association
  teamId: string | null;
  teamCode: string | null;
  codeType: CodeType | null; // Which type of code was used to join

  // Event context
  currentEventId: string | null;

  // Picture pledge settings for current event
  picturePledgeEnabled: boolean;
  currentEventOverlayId: string | null;

  // Kiosk mode
  isKioskMode: boolean;
  adminPin: string;

  // Local photo transfer mode
  localPhotoTransferEnabled: boolean;
  tabletLocalIp: string | null;
  tabletLocalPort: number;
}

interface DeviceActions {
  setDeviceConfig: (config: Partial<DeviceState>) => void;
  setCurrentEvent: (eventId: string | null) => void;
  enterKioskMode: () => void;
  exitKioskMode: (pin: string) => boolean;
  reset: () => void;
}

// Hydration state is kept outside DeviceState so it is never persisted and
// never wiped by reset().
interface DeviceHydration {
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
}

const initialState: DeviceState = {
  deviceId: null,
  deviceName: null,
  deviceType: null,
  teamId: null,
  teamCode: null,
  codeType: null,
  currentEventId: null,
  picturePledgeEnabled: false,
  currentEventOverlayId: null,
  isKioskMode: false,
  adminPin: '1234',
  localPhotoTransferEnabled: false,
  tabletLocalIp: null,
  tabletLocalPort: 8082,
};

export const useDeviceStore = create<DeviceState & DeviceActions & DeviceHydration>()(
  persist(
    (set, get) => ({
      ...initialState,

      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

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
        codeType: state.codeType,
        adminPin: state.adminPin,
        localPhotoTransferEnabled: state.localPhotoTransferEnabled,
        tabletLocalIp: state.tabletLocalIp,
        tabletLocalPort: state.tabletLocalPort,
        // The selected event must survive an app restart. Without it a relaunched
        // tablet/phone has no eventId, which silently drops pledges and blocks
        // photo capture. It mirrors the `current_event` row in SQLite.
        currentEventId: state.currentEventId,
        picturePledgeEnabled: state.picturePledgeEnabled,
        currentEventOverlayId: state.currentEventOverlayId,
        // Don't persist isKioskMode - kiosk should never be locked on cold start
      }),
      // AsyncStorage reads are async, so the store starts empty and fills in a
      // tick later. Screens must wait for this before deciding "not configured".
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selector hooks for accessing specific state slices
export const useDeviceHydrated = () => useDeviceStore((s) => s._hasHydrated);
export const useDeviceId = () => useDeviceStore((s) => s.deviceId);
export const useDeviceType = () => useDeviceStore((s) => s.deviceType);
export const useTeamId = () => useDeviceStore((s) => s.teamId);
export const useTeamCode = () => useDeviceStore((s) => s.teamCode);
export const useCodeType = () => useDeviceStore((s) => s.codeType);
export const useCurrentEventId = () => useDeviceStore((s) => s.currentEventId);
export const useIsKioskMode = () => useDeviceStore((s) => s.isKioskMode);
export const usePicturePledgeEnabled = () => useDeviceStore((s) => s.picturePledgeEnabled);
export const useCurrentEventOverlayId = () => useDeviceStore((s) => s.currentEventOverlayId);
export const useLocalPhotoTransferEnabled = () => useDeviceStore((s) => s.localPhotoTransferEnabled);
export const useTabletLocalIp = () => useDeviceStore((s) => s.tabletLocalIp);
export const useTabletLocalPort = () => useDeviceStore((s) => s.tabletLocalPort);
