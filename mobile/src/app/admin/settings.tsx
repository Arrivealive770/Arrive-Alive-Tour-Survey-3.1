import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  Users,
  Tablet,
  Lock,
  RotateCcw,
  Trash2,
  Info,
  ChevronRight,
  X,
  Check,
  Wifi,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSyncStore } from '@/lib/state/sync-store';
import { getDatabase } from '@/lib/db/database';
import { cn } from '@/lib/cn';

// App version info
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

export default function SettingsScreen() {
  const router = useRouter();
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Local transfer modal state
  const [showLocalTransferModal, setShowLocalTransferModal] = useState(false);
  const [editIp, setEditIp] = useState('');
  const [editPort, setEditPort] = useState('');

  // Device store
  const deviceId = useDeviceStore((s) => s.deviceId);
  const deviceName = useDeviceStore((s) => s.deviceName);
  const deviceType = useDeviceStore((s) => s.deviceType);
  const teamId = useDeviceStore((s) => s.teamId);
  const teamCode = useDeviceStore((s) => s.teamCode);
  const adminPin = useDeviceStore((s) => s.adminPin);
  const isKioskMode = useDeviceStore((s) => s.isKioskMode);
  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);
  const enterKioskMode = useDeviceStore((s) => s.enterKioskMode);
  const resetDevice = useDeviceStore((s) => s.reset);

  // Local photo transfer settings
  const localPhotoTransferEnabled = useDeviceStore((s) => s.localPhotoTransferEnabled);
  const tabletLocalIp = useDeviceStore((s) => s.tabletLocalIp);
  const tabletLocalPort = useDeviceStore((s) => s.tabletLocalPort);

  // Sync store
  const pendingSurveys = useSyncStore((s) => s.pendingSurveys);
  const pendingPledges = useSyncStore((s) => s.pendingPledges);
  const pendingPhotos = useSyncStore((s) => s.pendingPhotos);
  const resetSync = useSyncStore((s) => s.reset);

  const handleChangePIN = () => {
    setPinError('');

    if (currentPin !== adminPin) {
      setPinError('Current PIN is incorrect');
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('New PIN must be 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setDeviceConfig({ adminPin: newPin });
    setShowPinModal(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    Alert.alert('Success', 'Admin PIN has been updated.');
  };

  const handleSaveLocalTransfer = () => {
    if (editIp && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(editIp)) {
      Alert.alert('Invalid IP', 'Please enter a valid IP address');
      return;
    }
    const port = parseInt(editPort, 10);
    if (editPort && (isNaN(port) || port < 1 || port > 65535)) {
      Alert.alert('Invalid Port', 'Please enter a valid port number (1-65535)');
      return;
    }

    setDeviceConfig({
      tabletLocalIp: editIp || null,
      tabletLocalPort: port || 8082,
    });
    setShowLocalTransferModal(false);
    Alert.alert('Saved', 'Local transfer settings updated');
  };

  const handleToggleLocalTransfer = () => {
    setDeviceConfig({ localPhotoTransferEnabled: !localPhotoTransferEnabled });
  };

  const handleResetKioskMode = () => {
    Alert.alert(
      'Reset Kiosk Mode',
      'This will exit kiosk mode and return to the setup screen. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            // Exit kiosk mode and navigate to setup
            if (isKioskMode) {
              enterKioskMode(); // Toggle off
            }
            router.replace('/setup' as any);
          },
        },
      ]
    );
  };

  const handlePurgeData = () => {
    const totalPending = pendingSurveys + pendingPledges + pendingPhotos;

    Alert.alert(
      'Purge All Local Data',
      `This will permanently delete all local data including:\n\n` +
        `- ${pendingSurveys} pending surveys\n` +
        `- ${pendingPledges} pending pledges\n` +
        `- ${pendingPhotos} pending photos\n` +
        `- All cached photos\n` +
        `- Device configuration\n\n` +
        `This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              await db.resetDatabase();
              resetDevice();
              resetSync();
              Alert.alert('Success', 'All local data has been purged.');
              router.replace('/' as any);
            } catch (error) {
              console.error('[Settings] Purge failed:', error);
              Alert.alert('Error', 'Failed to purge data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const SettingRow = ({
    icon: Icon,
    iconColor,
    title,
    subtitle,
    onPress,
    danger,
    rightElement,
  }: {
    icon: typeof Users;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    danger?: boolean;
    rightElement?: React.ReactNode;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'flex-row items-center py-4 px-4 bg-zinc-900 rounded-xl mb-3',
        onPress ? 'active:bg-zinc-800' : null
      )}
    >
      <View
        className={cn(
          'w-10 h-10 rounded-xl items-center justify-center mr-4',
          danger ? 'bg-red-500/20' : 'bg-zinc-800'
        )}
      >
        <Icon size={20} color={danger ? '#ef4444' : iconColor} />
      </View>
      <View className="flex-1">
        <Text className={cn('font-medium', danger ? 'text-red-500' : 'text-white')}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-zinc-500 text-sm mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {rightElement ? (
        rightElement
      ) : onPress ? (
        <ChevronRight size={20} color="#71717a" />
      ) : null}
    </Pressable>
  );

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Team Info */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1">
        Team Information
      </Text>
      <View className="bg-zinc-900 rounded-xl p-4 mb-6">
        <View className="flex-row justify-between mb-3">
          <Text className="text-zinc-400">Team Code</Text>
          <Text className="text-white font-mono">{teamCode || 'Not set'}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-zinc-400">Team ID</Text>
          <Text className="text-white font-mono text-sm">
            {teamId ? `${teamId.slice(0, 8)}...` : 'Not set'}
          </Text>
        </View>
      </View>

      {/* Device Info */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1">
        Device Configuration
      </Text>
      <View className="bg-zinc-900 rounded-xl p-4 mb-6">
        <View className="flex-row justify-between mb-3">
          <Text className="text-zinc-400">Device Name</Text>
          <Text className="text-white">{deviceName || 'Not set'}</Text>
        </View>
        <View className="flex-row justify-between mb-3">
          <Text className="text-zinc-400">Device Type</Text>
          <Text className="text-white capitalize">{deviceType || 'Not set'}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-zinc-400">Device ID</Text>
          <Text className="text-white font-mono text-sm">
            {deviceId ? `${deviceId.slice(0, 8)}...` : 'Not set'}
          </Text>
        </View>
      </View>

      {/* Security Settings */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1">
        Security
      </Text>
      <SettingRow
        icon={Lock}
        iconColor="#3b82f6"
        title="Change Admin PIN"
        subtitle="Update the PIN used to access admin features"
        onPress={() => setShowPinModal(true)}
      />

      {/* Local Photo Transfer */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1 mt-3">
        Local Photo Transfer (Offline Mode)
      </Text>

      {/* Enable/Disable Toggle */}
      <SettingRow
        icon={Wifi}
        iconColor={localPhotoTransferEnabled ? '#22c55e' : '#71717a'}
        title="Enable Local Transfer"
        subtitle={localPhotoTransferEnabled ? 'Photos sent directly to tablet via hotspot' : 'Photos sync to cloud when online'}
        onPress={handleToggleLocalTransfer}
        rightElement={
          <View className={cn(
            'w-12 h-7 rounded-full items-center justify-center',
            localPhotoTransferEnabled ? 'bg-green-500' : 'bg-zinc-700'
          )}>
            <View className={cn(
              'w-5 h-5 rounded-full bg-white',
              localPhotoTransferEnabled ? 'ml-auto mr-1' : 'mr-auto ml-1'
            )} />
          </View>
        }
      />

      {/* Tablet IP Configuration - only show when enabled */}
      {localPhotoTransferEnabled ? (
        <SettingRow
          icon={Tablet}
          iconColor="#3b82f6"
          title="Tablet Address"
          subtitle={tabletLocalIp ? `${tabletLocalIp}:${tabletLocalPort}` : 'Not configured - tap to set'}
          onPress={() => {
            setEditIp(tabletLocalIp || '');
            setEditPort(String(tabletLocalPort));
            setShowLocalTransferModal(true);
          }}
        />
      ) : null}

      {/* Info box about local transfer */}
      {localPhotoTransferEnabled ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-3">
          <Text className="text-blue-400 font-semibold mb-2">
            Offline Mode Active
          </Text>
          <Text className="text-zinc-400 text-sm">
            Photos will be sent directly to the tablet over the local hotspot network.
            Make sure the phone is connected to the tablet's WiFi hotspot.
          </Text>
        </View>
      ) : null}

      {/* Kiosk Mode */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1 mt-3">
        Kiosk Mode
      </Text>
      <SettingRow
        icon={RotateCcw}
        iconColor="#f59e0b"
        title="Reset Kiosk Mode"
        subtitle="Exit current mode and return to setup"
        onPress={handleResetKioskMode}
      />

      {/* Danger Zone */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1 mt-3">
        Danger Zone
      </Text>
      <SettingRow
        icon={Trash2}
        iconColor="#ef4444"
        title="Purge All Local Data"
        subtitle="Delete all surveys, pledges, and photos"
        onPress={handlePurgeData}
        danger
      />

      {/* App Info */}
      <Text className="text-zinc-500 text-sm uppercase tracking-wider mb-3 ml-1 mt-3">
        About
      </Text>
      <View className="bg-zinc-900 rounded-xl p-4 mb-6">
        <View className="flex-row justify-between mb-3">
          <Text className="text-zinc-400">App Version</Text>
          <Text className="text-white">{APP_VERSION}</Text>
        </View>
        <View className="flex-row justify-between mb-3">
          <Text className="text-zinc-400">Build</Text>
          <Text className="text-white">{BUILD_NUMBER}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-zinc-400">Platform</Text>
          <Text className="text-white">Arrive Alive Tour</Text>
        </View>
      </View>

      {/* Pending Data Warning */}
      {pendingSurveys + pendingPledges + pendingPhotos > 0 ? (
        <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <Text className="text-amber-500 font-semibold mb-2">
            Unsynced Data Warning
          </Text>
          <Text className="text-zinc-400 text-sm">
            You have {pendingSurveys + pendingPledges + pendingPhotos} items waiting to
            sync. Make sure to sync before purging data or the information will be lost.
          </Text>
        </View>
      ) : null}

      {/* Change PIN Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPinModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">Change Admin PIN</Text>
              <Pressable
                onPress={() => {
                  setShowPinModal(false);
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmPin('');
                  setPinError('');
                }}
                className="p-2"
              >
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <View className="px-6 py-4">
              {/* Current PIN */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Current PIN</Text>
                <TextInput
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  placeholder="Enter current PIN"
                  placeholderTextColor="#52525b"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest"
                />
              </View>

              {/* New PIN */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">New PIN</Text>
                <TextInput
                  value={newPin}
                  onChangeText={setNewPin}
                  placeholder="Enter new 4-digit PIN"
                  placeholderTextColor="#52525b"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest"
                />
              </View>

              {/* Confirm PIN */}
              <View className="mb-4">
                <Text className="text-zinc-400 text-sm mb-2">Confirm New PIN</Text>
                <TextInput
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder="Confirm new PIN"
                  placeholderTextColor="#52525b"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={4}
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest"
                />
              </View>

              {/* Error */}
              {pinError ? (
                <Text className="text-red-500 text-sm text-center mb-4">{pinError}</Text>
              ) : null}

              {/* Save Button */}
              <Pressable
                onPress={handleChangePIN}
                className="bg-blue-600 py-4 rounded-xl items-center mb-6 active:bg-blue-700"
              >
                <Text className="text-white font-semibold">Update PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Local Transfer Settings Modal */}
      <Modal
        visible={showLocalTransferModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLocalTransferModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl">
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
              <Text className="text-xl font-bold text-white">Tablet Address</Text>
              <Pressable onPress={() => setShowLocalTransferModal(false)} className="p-2">
                <X size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <View className="px-6 py-4">
              <Text className="text-zinc-400 text-sm mb-2">Tablet IP Address</Text>
              <TextInput
                value={editIp}
                onChangeText={setEditIp}
                placeholder="e.g., 192.168.43.1"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-lg mb-4"
              />

              <Text className="text-zinc-400 text-sm mb-2">Port</Text>
              <TextInput
                value={editPort}
                onChangeText={setEditPort}
                placeholder="8082"
                placeholderTextColor="#52525b"
                keyboardType="number-pad"
                className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-lg mb-4"
              />

              <Text className="text-zinc-500 text-sm mb-6">
                Enter the tablet's local IP address. When the tablet creates a WiFi hotspot, it's usually 192.168.43.1
              </Text>

              <Pressable
                onPress={handleSaveLocalTransfer}
                className="bg-blue-600 py-4 rounded-xl items-center mb-6"
              >
                <Text className="text-white font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
