// Native builds keep using the device keychain. Web restores a persistent HttpOnly cookie; tab storage is only read for legacy migration.
export * from 'expo-secure-store';
