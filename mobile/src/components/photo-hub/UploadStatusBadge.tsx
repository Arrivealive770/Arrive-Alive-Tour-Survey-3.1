import { View, Text } from 'react-native';
import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react-native';

type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

interface UploadStatusBadgeProps {
  status: UploadStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.2)',
    label: 'Pending',
  },
  uploading: {
    icon: Loader2,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.2)',
    label: 'Uploading',
  },
  uploaded: {
    icon: CheckCircle,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.2)',
    label: 'Done',
  },
  failed: {
    icon: XCircle,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.2)',
    label: 'Failed',
  },
};

const SIZE_CONFIG = {
  sm: { icon: 14, badge: 24, text: 10 },
  md: { icon: 18, badge: 32, text: 12 },
  lg: { icon: 24, badge: 44, text: 14 },
};

export function UploadStatusBadge({
  status,
  size = 'md',
  showLabel = false,
}: UploadStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <View
        style={{
          width: sizeConfig.badge,
          height: sizeConfig.badge,
          borderRadius: sizeConfig.badge / 2,
          backgroundColor: config.bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={sizeConfig.icon} color={config.color} />
      </View>
      {showLabel ? (
        <Text
          style={{
            color: config.color,
            fontSize: sizeConfig.text,
            fontWeight: '600',
          }}
        >
          {config.label}
        </Text>
      ) : null}
    </View>
  );
}
