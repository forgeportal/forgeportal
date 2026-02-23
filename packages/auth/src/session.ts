export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

export interface SessionData {
  user: UserInfo;
  iat: number;
  exp: number;
}

export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export const DEV_USER: UserInfo = {
  sub: 'dev-user',
  email: 'dev@forgeportal.local',
  name: 'Dev User',
  groups: ['platform-admin'],
};
