import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { House } from 'lucide-react-native';

/**
 * "Menu" button for a screen header.
 *
 * Uses replace rather than back so it always lands on the main menu, whatever
 * route the crew wandered in through — a half-remembered back stack is how
 * staff end up stuck mid-flow at an event.
 */
export function HomeHeaderButton({ label = 'Menu' }: { label?: string }) {
  return (
    <Pressable
      onPress={() => router.replace('/')}
      hitSlop={12}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: pressed ? '#27272a' : 'transparent',
      })}
    >
      <House size={20} color="#3b82f6" />
      <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
