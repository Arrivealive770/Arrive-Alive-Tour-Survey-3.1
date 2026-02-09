import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X, Delete } from 'lucide-react-native';

interface KioskExitModalProps {
  visible: boolean;
  correctPin: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function KioskExitModal({ visible, correctPin, onSuccess, onClose }: KioskExitModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError(false);
    }
  }, [visible]);

  const handleNumberPress = useCallback((num: string) => {
    if (pin.length >= 6) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPin = pin + num;
    setPin(newPin);
    setError(false);

    // Auto-submit when 4 digits reached
    if (newPin.length === 4) {
      if (newPin === correctPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 500);
      }
    }
  }, [pin, correctPin, onSuccess]);

  const handleDelete = useCallback(() => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
    setError(false);
  }, [pin]);

  const renderPinDots = () => {
    return (
      <View className="flex-row justify-center gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className={`w-4 h-4 rounded-full ${
              pin.length > i
                ? error
                  ? 'bg-red-500'
                  : 'bg-green-500'
                : 'bg-zinc-700'
            }`}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'del'],
    ];

    return (
      <View className="gap-3">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-center gap-3">
            {row.map((item, itemIndex) => {
              if (item === '') {
                return <View key={itemIndex} className="w-20 h-20" />;
              }

              if (item === 'del') {
                return (
                  <Pressable
                    key={itemIndex}
                    onPress={handleDelete}
                    className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                  >
                    <Delete size={28} color="#ffffff" />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={itemIndex}
                  onPress={() => handleNumberPress(item)}
                  className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-white text-3xl font-semibold">{item}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        className="flex-1 bg-black/90 items-center justify-center"
      >
        <Animated.View
          entering={SlideInDown.duration(300)}
          className="w-80 bg-zinc-900 rounded-3xl p-6"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Exit Kiosk Mode</Text>
            <Pressable
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center"
            >
              <X size={24} color="#a1a1aa" />
            </Pressable>
          </View>

          <Text className="text-zinc-400 text-center mb-6">
            Enter the admin PIN to exit
          </Text>

          {/* PIN Display */}
          {renderPinDots()}

          {/* Error Message */}
          {error ? (
            <Text className="text-red-500 text-center mb-4">
              Incorrect PIN
            </Text>
          ) : null}

          {/* Number Pad */}
          {renderNumberPad()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
