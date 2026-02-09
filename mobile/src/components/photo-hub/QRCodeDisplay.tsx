import { View, Text } from 'react-native';
import { QrCode } from 'lucide-react-native';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * QR Code Display Component
 *
 * Note: This is a placeholder that displays the QR value as text.
 * In a production app with react-native-qrcode-svg installed,
 * this would render an actual QR code.
 */
export function QRCodeDisplay({
  value,
  size = 200,
  label,
}: QRCodeDisplayProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: '#fff',
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <QrCode size={size * 0.5} color="#18181b" />
        <Text
          style={{
            color: '#71717a',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 8,
          }}
          numberOfLines={2}
        >
          {value.length > 20 ? value.slice(0, 20) + '...' : value}
        </Text>
      </View>
      {label ? (
        <Text
          style={{
            color: '#a1a1aa',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
