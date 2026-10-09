export const AllParticipantThemeColors = [
  'blue',
  'green',
  'orange',
  'purple',
  'red',
  'yellow',
] as const;

export type ParticipantThemeColor = (typeof AllParticipantThemeColors)[number];
