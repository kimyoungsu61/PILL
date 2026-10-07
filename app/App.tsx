import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { configureDoseNotificationHandler } from './src/notifications/doseReminderNotifications';

configureDoseNotificationHandler();

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
