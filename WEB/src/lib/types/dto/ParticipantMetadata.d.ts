import { ParticipantThemeColor } from './ParticipantThemeColors';

export type ParticipantMetadata = {
  joinedAt: string;
  displayName: string;
  themeColor: ParticipantThemeColor;
  cursorX: number;
  cursorY: number;
};
