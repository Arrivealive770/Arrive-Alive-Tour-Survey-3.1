import { View, Text, ScrollView } from 'react-native';
import { Camera } from 'lucide-react-native';
import { PhotoCard } from './PhotoCard';
import { CachedPhoto, usePhotoCacheStore } from '@/lib/state/photo-cache-store';

interface PhotoGridProps {
  selectedPhotoId: string | null;
  onSelectPhoto: (localId: string) => void;
}

export function PhotoGrid({ selectedPhotoId, onSelectPhoto }: PhotoGridProps) {
  const cachedPhotos = usePhotoCacheStore((s) => s.cachedPhotos);

  // Filter to only show available photos
  const availablePhotos = cachedPhotos.filter(
    (p) => p.status === 'available' || p.localId === selectedPhotoId
  );

  if (availablePhotos.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            backgroundColor: '#27272a',
            padding: 24,
            borderRadius: 999,
            marginBottom: 20,
          }}
        >
          <Camera size={48} color="#71717a" />
        </View>
        <Text
          style={{
            color: '#ffffff',
            fontSize: 22,
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          No Photos Available
        </Text>
        <Text
          style={{
            color: '#a1a1aa',
            fontSize: 16,
            textAlign: 'center',
            lineHeight: 24,
          }}
        >
          Please see a team member to have your photo taken.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
        gap: 12,
      }}
      showsVerticalScrollIndicator={false}
    >
      {availablePhotos.map((photo) => (
        <PhotoCard
          key={photo.localId}
          photo={photo}
          isSelected={selectedPhotoId === photo.localId}
          onSelect={onSelectPhoto}
        />
      ))}
    </ScrollView>
  );
}
