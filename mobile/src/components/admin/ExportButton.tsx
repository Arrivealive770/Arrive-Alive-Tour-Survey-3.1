import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Download, Check, AlertCircle } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { cn } from '@/lib/cn';

interface ExportButtonProps {
  onExport: () => Promise<string>; // Returns CSV content
  fileName?: string;
  className?: string;
}

export function ExportButton({
  onExport,
  fileName = 'export.csv',
  className,
}: ExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setStatus('loading');
      setError(null);

      // Get CSV content
      const csvContent = await onExport();

      // Save to file
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Open share sheet
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Data',
        UTI: 'public.comma-separated-values-text',
      });

      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('[ExportButton] Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="text-blue-500 font-medium ml-2">Exporting...</Text>
          </>
        );
      case 'success':
        return (
          <>
            <Check size={20} color="#22c55e" />
            <Text className="text-green-500 font-medium ml-2">Exported!</Text>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle size={20} color="#ef4444" />
            <Text className="text-red-500 font-medium ml-2">Failed</Text>
          </>
        );
      default:
        return (
          <>
            <Download size={20} color="#3b82f6" />
            <Text className="text-blue-500 font-medium ml-2">Export CSV</Text>
          </>
        );
    }
  };

  return (
    <View className={className}>
      <Pressable
        onPress={handleExport}
        disabled={status === 'loading'}
        className={cn(
          'flex-row items-center justify-center py-3 px-6 rounded-xl border',
          status === 'loading'
            ? 'bg-zinc-900 border-zinc-700'
            : status === 'success'
            ? 'bg-green-500/10 border-green-500/30'
            : status === 'error'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-blue-500/10 border-blue-500/30 active:bg-blue-500/20'
        )}
      >
        {getButtonContent()}
      </Pressable>

      {error ? (
        <Text className="text-red-500 text-sm mt-2 text-center">{error}</Text>
      ) : null}
    </View>
  );
}
