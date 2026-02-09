import { View, Text } from 'react-native';
import { type OverlayType, getOverlayConfig } from '@/lib/overlays/overlay-service';

interface OverlayPreviewProps {
  overlayType: OverlayType;
  showBadge?: boolean;
}

export function OverlayPreview({ overlayType, showBadge = true }: OverlayPreviewProps) {
  const config = getOverlayConfig(overlayType);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Frame overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderWidth: 8,
          borderColor: config.color,
          borderRadius: 0,
        }}
      />

      {/* Top banner */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: config.color,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '800',
            letterSpacing: 1,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {config.text}
        </Text>
      </View>

      {/* Bottom banner */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 50,
          backgroundColor: config.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
          }}
        >
          #ArriveAliveTour
        </Text>
      </View>

      {/* Overlay type badge in corner */}
      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: 68,
            left: 16,
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
          }}
        >
          <Text
            style={{
              color: config.color,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {config.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
