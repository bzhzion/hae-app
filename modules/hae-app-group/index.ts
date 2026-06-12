import { NativeModules, Platform } from 'react-native';

const { HaeAppGroup } = NativeModules;

export function saveToAppGroup(serverUrl: string, token: string): void {
  if (Platform.OS === 'ios' && HaeAppGroup) {
    HaeAppGroup.save(serverUrl, token);
  }
}

export function clearAppGroup(): void {
  if (Platform.OS === 'ios' && HaeAppGroup) {
    HaeAppGroup.clear();
  }
}
