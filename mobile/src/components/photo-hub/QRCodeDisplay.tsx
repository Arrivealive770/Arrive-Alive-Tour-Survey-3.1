import { View, Text } from 'react-native';
import { Hash } from 'lucide-react-native';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * Photo ID display.
 *
 * The app has no barcode scanner anywhere, so a QR code here would be
 * decorative. This shows the identifier itself, big and readable, so it can be
 * matched or read out loud between the phone and the tablet.
 */
export function QRCodeDisplay({ value, size = 200, label }: QRCodeDisplayProps) {
  // The local id is a uuid; the first block is enough to identify a photo
  // within an event and is short enough to read at a glance.
  const shortCode = value.split('-')[0]?.toUpperCase() ?? value.toUpperCase();

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View
        style={{
          minWidth: size,
          backgroundColor: '#fff',
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 24,
          paddingHorizontal: 20,
        }}
      >
        <Hash size={28} color="#71717a" />
        <Text
          style={{
            color: '#18181b',
            fontSize: 36,
            fontWeight: '700',
            letterSpacing: 2,
            marginTop: 8,
          }}
        >
          {shortCode}
        </Text>
        <Text
          style={{
            color: '#71717a',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 10,
          }}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {label ? (
        <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center' }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
