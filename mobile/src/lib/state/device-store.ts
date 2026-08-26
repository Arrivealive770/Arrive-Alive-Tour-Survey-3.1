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
  // Only teams designated as admin teams in the admin portal may open the
  // Admin section. Remembered here so an offline device still knows, but it is
  // re-checked with the server every time Admin is opened.
  isAdminTeam: boolean;

  // Event context
  currentEventId: string | null;
  /** Venue name of the running event, so the main menu can name it offline. */
  currentEventVenue: string | null;
  /** Event day, ISO. Used to end the event when the calendar day rolls over. */
  currentEventDate: string | null;
  /** Scheduled end time, ISO, or null when the event has no scheduled end. */
  currentEventEndAt: string | null;
  /** Server status of the running event. 'completed' means it is over. */
  currentEventStatus: 'active' | 'completed' | null;

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
  /**
   * Forget the running event without touching the team/device pairing, so the
   * crew lands back on the main menu ready to pick the next area rather than
   * having to re-enter their team code.
   */
  clearCurrentEvent: () => void;
  enterKioskMode: () => void;
  /** Leaving kiosk mode is a staff gesture (triple tap), not a PIN check. */
  exitKioskMode: () => void;
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
  isAdminTeam: false,
  currentEventId: null,
  currentEventVenue: null,
  currentEventDate: null,
  currentEventEndAt: null,
  currentEventStatus: null,
  picturePledgeEnabled: false,
  currentEventOverlayId: null,
  isKioskMode: false,
  adminPin: '1234',
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

      clearCurrentEvent: () => {
        set({
          currentEventId: null,
          currentEventVenue: null,
          currentEventDate: null,
          currentEventEndAt: null,
          currentEventStatus: null,
          currentEventOverlayId: null,
          picturePledgeEnabled: false,
          isKioskMode: false,
        });
      },

      enterKioskMode: () => {
        set({ isKioskMode: true });
      },

      exitKioskMode: () => {
        set({ isKioskMode: false });
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
        isAdminTeam: state.isAdminTeam,
        adminPin: state.adminPin,
        // The selected event must survive an app restart. Without it a relaunched
        // tablet/phone has no eventId, which silently drops pledges and blocks
        // photo capture. It mirrors the `current_event` row in SQLite.
        currentEventId: state.currentEventId,
        // Kept alongside the id so a device with no signal can still tell that
        // the event is over and offer the next one.
        currentEventVenue: state.currentEventVenue,
        currentEventDate: state.currentEventDate,
        currentEventEndAt: state.currentEventEndAt,
        currentEventStatus: state.currentEventStatus,
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
export const useIsAdminTeam = () => useDeviceStore((s) => s.isAdminTeam);
export const useCodeType = () => useDeviceStore((s) => s.codeType);
export const useCurrentEventId = () => useDeviceStore((s) => s.currentEventId);
export const useCurrentEventVenue = () => useDeviceStore((s) => s.currentEventVenue);
export const useIsKioskMode = () => useDeviceStore((s) => s.isKioskMode);
export const usePicturePledgeEnabled = () => useDeviceStore((s) => s.picturePledgeEnabled);
export const useCurrentEventOverlayId = () => useDeviceStore((s) => s.currentEventOverlayId);
