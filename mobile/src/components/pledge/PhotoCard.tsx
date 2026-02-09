import { useCallback } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { CachedPhoto } from '@/lib/state/photo-cache-store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PhotoCardProps {
  photo: CachedPhoto;
  isSelected: boolean;
  onSelect: (localId: string) => void;
}

export function PhotoCard({ photo, isSelected, onSelect }: PhotoCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(photo.localId);
  }, [onSelect, photo.localId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        animatedStyle,
        {
          width: '47%',
          aspectRatio: 3 / 4,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: isSelected ? 4 : 2,
          borderColor: isSelected ? '#22c55e' : '#27272a',
        },
      ]}
    >
      {/* Photo Image */}
      <Image
        source={{ uri: photo.localPath }}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
        }}
        resizeMode="cover"
      />

      {/* Overlay Type Badge */}
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
        }}
      >
        <Text
          style={{
            color: '#ffffff',
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'uppercase',
          }}
        >
          {photo.overlayType}
        </Text>
      </View>

      {/* Selection Checkmark Overlay */}
      {isSelected ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#22c55e',
              borderRadius: 999,
              padding: 12,
            }}
          >
            <Check size={32} color="#000000" strokeWidth={3} />
          </View>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
