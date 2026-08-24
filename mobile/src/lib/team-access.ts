import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import { useDeviceStore } from '@/lib/state/device-store';

/**
 * Whether this device's team is allowed into the Admin section.
 *
 * Teams are designated as admin teams in the admin portal (Teams tab). A field
 * team's tablet joins with a team code and can run surveys and pledge photos,
 * but must not be able to reach events, devices, results or the data wipe.
 *
 * The answer is re-checked with the server on every use so a team that loses
 * admin rights loses them on the next tap. Off the network the last known
 * answer is used, which for a device that has never been told otherwise is
 * "no" — the safe direction.
 */
export interface TeamAccess {
  id: string;
  name: string;
  code: string;
  isAdminTeam: boolean;
}

export function useTeamAdminAccess() {
  const teamId = useDeviceStore((s) => s.teamId);
  const storedIsAdminTeam = useDeviceStore((s) => s.isAdminTeam);
  const setDeviceConfig = useDeviceStore((s) => s.setDeviceConfig);

  const query = useQuery({
    queryKey: ['team-access', teamId],
    enabled: !!teamId,
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: () => api.get<TeamAccess>(`/api/teams/${teamId}/access`),
  });

  const serverAnswer = query.data?.isAdminTeam;

  // Remember it so the gate still works at a venue with no signal.
  useEffect(() => {
    if (serverAnswer !== undefined && serverAnswer !== storedIsAdminTeam) {
      setDeviceConfig({ isAdminTeam: serverAnswer });
    }
  }, [serverAnswer, storedIsAdminTeam, setDeviceConfig]);

  return {
    isAdminTeam: serverAnswer ?? storedIsAdminTeam,
    teamName: query.data?.name ?? null,
    /** First check still in flight and nothing stored to fall back on. */
    isChecking: !!teamId && query.isLoading && !storedIsAdminTeam,
    /** The server could not be reached, so this is the last known answer. */
    isStale: query.isError,
  };
}
