import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { Pressable } from 'react-native';

// Taps further apart than this start the count again.
const TAP_GAP_MS = 500;

/** Opens the kiosk Staff Menu. Provided by app/kiosk/_layout.tsx. */
export const StaffMenuContext = createContext<(() => void) | null>(null);

interface StaffTripleTapProps {
  children: ReactNode;
  testID?: string;
}

// Triple tap on a heading opens the Staff Menu — quicker for staff to find at
// the end of an event than the corner hold. It opens the menu rather than
// exiting, because a triple tap that exited straight away was being hit by
// students; the menu still has Cancel.
export function StaffTripleTap({ children, testID }: StaffTripleTapProps) {
  const openStaffMenu = useContext(StaffMenuContext);
  const lastTapRef = useRef(0);
  const tapCountRef = useRef(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    tapCountRef.current = now - lastTapRef.current < TAP_GAP_MS ? tapCountRef.current + 1 : 1;
    lastTapRef.current = now;

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      openStaffMenu?.();
    }
  }, [openStaffMenu]);

  return (
    <Pressable onPress={handlePress} hitSlop={12} testID={testID}>
      {children}
    </Pressable>
  );
}
