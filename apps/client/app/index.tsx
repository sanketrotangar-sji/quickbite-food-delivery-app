import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { LogoLoader } from '@/components/LogoLoader';
import { useAuth } from '@/hooks/useAuth';
import { readLastRole, type AppSide } from '@/lib/last-role';
import { hasRole } from '@/types/models';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [role, setRole] = useState<AppSide | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    void readLastRole().then((value) => {
      setRole(value);
      setRoleReady(true);
    });
  }, []);

  if (loading || !roleReady) return <LogoLoader />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (role === 'rider' && hasRole(profile, 'rider')) return <Redirect href="/(rider)/(tabs)" />;
  return <Redirect href="/(customer)/(tabs)" />;
}
