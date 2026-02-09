import { View, Text, Pressable, Image } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { UploadStatusBadge } from './UploadStatusBadge';
import { getOverlayConfig, type OverlayType } from '@/lib/overlays/overlay-service';
import type { PhotoQueueItem } from '@/lib/db/schema';

interface PhotoQueueItemProps {
  photo: PhotoQueueItem;
  onDelete?: (localId: string) => void;
  onPress?: (photo: PhotoQueueItem) => void;
}

export function PhotoQueueItemCard({ photo, onDelete, onPress }: PhotoQueueItemProps) {
  const overlayConfig = getOverlayConfig(photo.overlayType as OverlayType);

  return (
    <Pressable
      onPress={() => onPress?.(photo)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: pressed ? '#27272a' : '#18181b',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#27272a',
      })}
    >
      {/* Thumbnail */}
      <View style={{ width: 100, height: 100, position: 'relative' }}>
        <Image
          source={{ uri: photo.localPath }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Overlay color indicator */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: overlayConfig.color,
          }}
        />
      </View>

      {/* Info */}
      <View style={{ flex: 1, padding: 12, justifyContent: 'center', gap: 8 }}>
        {/* Overlay type badge */}
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: overlayConfig.color + '20',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              color: overlayConfig.color,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {overlayConfig.label}
          </Text>
        </View>

        {/* Time */}
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          {new Date(photo.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {/* Upload status */}
        <UploadStatusBadge
          status={photo.uploadStatus}
          size="sm"
          showLabel
        />
      </View>

      {/* Delete button */}
      {onDelete ? (
        <Pressable
          onPress={() => onDelete(photo.localId)}
          style={({ pressed }) => ({
            width: 56,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
          })}
        >
          <Trash2 size={22} color="#ef4444" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
