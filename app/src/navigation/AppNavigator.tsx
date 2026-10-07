import { useEffect, useRef } from 'react';
import { registerWebPushWorker } from '../notifications/webPush';
import { ActivityIndicator, Platform, StatusBar, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isRunningInExpoGo } from 'expo';
import { CalendarCheck2, Settings, Pill } from 'lucide-react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScanResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { notificationSupplementId } from '../notifications/doseReminderNotifications';
import { supportsNotificationNavigation } from './platformNavigation';
import DoseHistoryScreen from '../screens/DoseHistoryScreen';
import ExportDataScreen from '../screens/ExportDataScreen';
import ImageInputScreen from '../screens/ImageInputScreen';
import LoginScreen from '../screens/LoginScreen';
import ManualSupplementScreen from '../screens/ManualSupplementScreen';
import type { ManualSupplementDraft } from '../screens/ManualSupplementScreen.helpers';
import MenuScreen from '../screens/MenuScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ScanHistoryScreen from '../screens/ScanHistoryScreen';
import ScanResultScreen from '../screens/ScanResultScreen';
import SignupScreen from '../screens/SignupScreen';
import SupplementDetailScreen from '../screens/SupplementDetailScreen';
import SupplementsScreen from '../screens/SupplementsScreen';
import TodayScreen from '../screens/TodayScreen';
import { colors, spacing } from '../theme';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ImageInput: undefined;
  ManualSupplement: ManualSupplementDraft | undefined;
  ScanResult: { result: ScanResult; imageUri?: string };
  SupplementDetail: { supplementId: number };
  NotificationSettings: undefined;
  DoseHistory: undefined;
  ScanHistory: undefined;
  ExportData: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  Supplements: undefined;
  Menu: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.muted,
        tabBarItemStyle: {
          marginHorizontal: 7,
          marginVertical: 4,
          borderRadius: 12,
        },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', height: 18, lineHeight: 16, marginTop: 1, overflow: 'visible' },
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.line,
          borderTopWidth: 1,
          height: 72 + Math.max(insets.bottom, spacing.sm),
          overflow: 'hidden',
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingTop: spacing.xs,
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: '오늘',
          tabBarIcon: ({ color, size }) => <CalendarCheck2 color={color} size={size} strokeWidth={2.4} />,
        }}
      />
      <Tab.Screen
        name="Supplements"
        component={SupplementsScreen}
        options={{
          title: '영양제',
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size} strokeWidth={2.4} />,
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

export default function AppNavigator() {
  const { token, isLoading } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const pendingWebSupplement = useRef<number | null>(null);
  function openPendingWebSupplement() {
    if (Platform.OS !== 'web' || !token || !navigationRef.isReady()) return;
    const fromUrl = Number(new URL(window.location.href).searchParams.get('supplementId'));
    const id = pendingWebSupplement.current || fromUrl;
    if (!Number.isSafeInteger(id) || id <= 0) return;
    pendingWebSupplement.current = null;
    const url = new URL(window.location.href); url.searchParams.delete('supplementId');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    navigationRef.navigate('SupplementDetail', { supplementId: id });
  }
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    void registerWebPushWorker()?.catch(() => undefined);
    function receiveWebNotification(event: MessageEvent) {
      const id = Number(event.data?.supplementId);
      if (event.data?.type !== 'PILL_OPEN_SUPPLEMENT' || !Number.isSafeInteger(id) || id <= 0) return;
      pendingWebSupplement.current = id; openPendingWebSupplement();
    }
    navigator.serviceWorker?.addEventListener('message', receiveWebNotification);
    openPendingWebSupplement();
    return () => navigator.serviceWorker?.removeEventListener('message', receiveWebNotification);
  }, [token, navigationRef]);

  useEffect(() => {
    if (!token || !supportsNotificationNavigation(Platform.OS) || isRunningInExpoGo()) {
      return undefined;
    }

    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    function openSupplementFromNotification(data: Record<string, unknown> | undefined) {
      const supplementId = notificationSupplementId(data);
      if (!supplementId || !navigationRef.isReady()) {
        return;
      }
      navigationRef.navigate('SupplementDetail', { supplementId });
      Notifications.clearLastNotificationResponse();
    }

    const lastResponse = Notifications.getLastNotificationResponse();
    openSupplementFromNotification(lastResponse?.notification.request.content.data);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openSupplementFromNotification(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, [navigationRef, token]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.sage} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer
        onReady={openPendingWebSupplement}
        ref={navigationRef}
        theme={{
          dark: false,
          colors: {
            background: colors.background,
            border: colors.line,
            card: colors.surface,
            notification: colors.warning,
            primary: colors.active,
            text: colors.ink,
          },
          fonts: {
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '700' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            regular: { fontFamily: 'System', fontWeight: '400' },
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerBackTitle: '이전',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.ink,
            headerTitleAlign: 'center',
            headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
          }}
        >
          {token ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="ImageInput" component={ImageInputScreen} options={{ title: '촬영' }} />
              <Stack.Screen name="ManualSupplement" component={ManualSupplementScreen} options={{ title: '직접 등록' }} />
              <Stack.Screen name="ScanResult" component={ScanResultScreen} options={{ title: '분석 결과' }} />
              <Stack.Screen name="SupplementDetail" component={SupplementDetailScreen} options={{ title: '상세' }} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: '알림 설정' }} />
              <Stack.Screen name="DoseHistory" component={DoseHistoryScreen} options={{ title: '복용 기록' }} />
              <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} options={{ title: '스캔 기록' }} />
              <Stack.Screen name="ExportData" component={ExportDataScreen} options={{ title: '내보내기' }} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'PILL' }} />
              <Stack.Screen name="Signup" component={SignupScreen} options={{ title: '시작하기' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
