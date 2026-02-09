import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Camera, SwitchCamera, Zap, ZapOff } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

interface CameraCaptureProps {
  onCapture: (uri: string) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

export interface CameraCaptureRef {
  takePicture: () => Promise<void>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CameraCapture = forwardRef<CameraCaptureRef, CameraCaptureProps>(
  function CameraCapture({ onCapture, onError, children }, ref) {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('off');
    const [isCapturing, setIsCapturing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    const takePicture = useCallback(async () => {
      if (!cameraRef.current || isCapturing) return;

      try {
        setIsCapturing(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: false,
        });

        if (photo?.uri) {
          onCapture(photo.uri);
        }
      } catch (error) {
        console.error('[CameraCapture] Error taking picture:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to capture photo'));
      } finally {
        setIsCapturing(false);
      }
    }, [isCapturing, onCapture, onError]);

    useImperativeHandle(ref, () => ({
      takePicture,
    }));

    const toggleFacing = useCallback(() => {
      setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
    }, []);

    const toggleFlash = useCallback(() => {
      setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
    }, []);

    // Permission handling
    if (!permission) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Camera size={64} color="#71717a" />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 24, textAlign: 'center' }}>
            Camera Access Required
          </Text>
          <Text style={{ color: '#a1a1aa', fontSize: 16, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
            We need camera access to take pledge photos.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={{
              backgroundColor: '#fff',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>
              Grant Permission
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          flash={flash}
        >
          {/* Overlay content */}
          {children}

          {/* Camera Controls */}
          <View
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              gap: 12,
            }}
          >
            {/* Flash toggle */}
            <Pressable
              onPress={toggleFlash}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {flash === 'on' ? (
                <Zap size={24} color="#fbbf24" fill="#fbbf24" />
              ) : (
                <ZapOff size={24} color="#fff" />
              )}
            </Pressable>

            {/* Camera flip */}
            <Pressable
              onPress={toggleFacing}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SwitchCamera size={24} color="#fff" />
            </Pressable>
          </View>

          {/* Capture button */}
          <View
            style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={takePicture}
              disabled={isCapturing}
              style={({ pressed }) => ({
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: pressed ? 'rgba(255,255,255,0.8)' : '#fff',
                borderWidth: 4,
                borderColor: 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isCapturing ? 0.7 : 1,
              })}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#fff',
                  }}
                />
              )}
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }
);
