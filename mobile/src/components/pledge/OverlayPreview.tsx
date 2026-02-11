import { View, Image } from 'react-native';

interface OverlayPreviewProps {
  photoUri: string;
  overlayUrl: string | null;
}

/**
 * Component that shows a selected photo with an overlay image on top.
 * The overlay is positioned as a border/frame around the photo.
 */
export function OverlayPreview({ photoUri, overlayUrl }: OverlayPreviewProps) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* Base photo */}
      <Image
        source={{ uri: photoUri }}
        style={{
          width: '100%',
          height: '100%',
        }}
        resizeMode="cover"
      />

      {/* Overlay image on top */}
      {overlayUrl ? (
        <Image
          source={{ uri: overlayUrl }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
          }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}
