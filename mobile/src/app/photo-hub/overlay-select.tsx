import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { usePhotoStore, useSelectedOverlay } from '@/lib/state/photo-store';
import {
  OVERLAY_CONFIGS,
  type OverlayType,
} from '@/lib/overlays/overlay-service';

export default function OverlaySelectScreen() {
  const selectedOverlay = useSelectedOverlay();
  const setOverlay = usePhotoStore((s) => s.setOverlay);

  const handleSelectOverlay = (type: OverlayType) => {
    setOverlay(type);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <Text className="text-zinc-400 text-sm mb-2 px-2">
          Tag your pledge photos with a topic. The frame around the photo comes
          from the event&apos;s own artwork, so this only labels the photo.
        </Text>

        {OVERLAY_CONFIGS.map((config) => {
          const isSelected = selectedOverlay === config.type;

          return (
            <Pressable
              key={config.type}
              onPress={() => handleSelectOverlay(config.type)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: pressed ? '#27272a' : '#18181b',
                borderRadius: 16,
                padding: 16,
                borderWidth: 2,
                borderColor: isSelected ? config.color : '#27272a',
              })}
            >
              {/* Color preview */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: '#000',
                  borderWidth: 4,
                  borderColor: config.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Text
                  style={{
                    color: config.color,
                    fontSize: 10,
                    fontWeight: '800',
                    textAlign: 'center',
                  }}
                >
                  AA
                </Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 4,
                  }}
                >
                  {config.label}
                </Text>
                <Text
                  style={{
                    color: '#71717a',
                    fontSize: 12,
                  }}
                  numberOfLines={1}
                >
                  {config.text}
                </Text>
              </View>

              {/* Selected indicator */}
              {isSelected ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: config.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={18} color="#fff" />
                </View>
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: '#3f3f46',
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Footer info */}
      <View className="px-6 py-4 border-t border-zinc-800">
        <Text className="text-zinc-500 text-center text-sm">
          The overlay will appear as a frame on all photos you take
        </Text>
      </View>
    </SafeAreaView>
  );
}
