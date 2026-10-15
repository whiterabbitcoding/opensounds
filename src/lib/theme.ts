import { useSettings, type Settings } from './settings';

export type Theme = {
  name: string;
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  dim: string;
  accent: string; // primary: buttons, selection
  accent2: string; // highlight: active track, progress
  accent3: string; // live: radio, stats
  onAccent: string;
  line: string;
  danger: string;
};

export const themes: Record<Settings['theme'], Theme> = {
  symposium: { name: 'Gold', dark: true, bg: '#0b0b0f', card: '#16161d', text: '#f2f2f5', dim: '#8a8a99', accent: '#c9a96e', accent2: '#c9a96e', accent3: '#7fb08a', onAccent: '#14110a', line: '#23232d', danger: '#e5736f' },
  // Dathomir: Nightsister red & black, Zabrak yellow, Nightsister-magick green
  dathomir: { name: 'Dathomir', dark: true, bg: '#0c0707', card: '#1b0f0f', text: '#f0e4d8', dim: '#8e7367', accent: '#c8282e', accent2: '#e9b824', accent3: '#3fc46d', onAccent: '#fff4ec', line: '#2e1818', danger: '#ff7a5c' },
  tokyo: { name: 'Tokyo Night', dark: true, bg: '#1a1b26', card: '#24283b', text: '#c0caf5', dim: '#565f89', accent: '#7aa2f7', accent2: '#e0af68', accent3: '#9ece6a', onAccent: '#16161e', line: '#2f334d', danger: '#f7768e' },
  light: { name: 'Light', dark: false, bg: '#fafaf7', card: '#ffffff', text: '#1c1c22', dim: '#6f6f7d', accent: '#a9822f', accent2: '#a9822f', accent3: '#3b8f5a', onAccent: '#ffffff', line: '#e4e2da', danger: '#c8433f' },
};

export const useTheme = () => themes[useSettings().theme] ?? themes.symposium;
