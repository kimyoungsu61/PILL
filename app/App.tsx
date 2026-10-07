import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AppStartup from './src/components/AppStartup';
import { configureDoseNotificationHandler } from './src/notifications/doseReminderNotifications';

configureDoseNotificationHandler();

export default function App() {
  return (
    <AuthProvider>
      <AppStartup><AppNavigator /></AppStartup>
    </AuthProvider>
  );
}
