import { RoleBlockedScreen } from '@/screens/shared/RoleBlockedScreen';

export default function RiderBlockedRoute() {
  return (
    <RoleBlockedScreen
      title="Riders only"
      body="Available deliveries are for rider accounts. You can keep ordering from home, or apply to deliver from your profile."
    />
  );
}
