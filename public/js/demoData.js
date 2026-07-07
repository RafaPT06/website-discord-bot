export const DEMO_USER = Object.freeze({
  id: '000000000000000001',
  username: 'demo_user',
  globalName: 'Demo User',
  avatar: null,
  discriminator: '0000',
  demo: true,
});

export const DEMO_BOT_STATS = Object.freeze({
  ok: true,
  name: 'Meowz Demo',
  tag: 'Meowz#3996',
  avatarUrl: null,
  status: 'online',
  ping: 18,
  servers: 4,
  users: 1284,
  commands: 84,
  uptime: '3d 7h',
  updatedAt: new Date().toISOString(),
  demo: true,
});

export const DEMO_DASHBOARD = Object.freeze({
  ok: true,
  isOwner: true,
  ownerMode: true,
  installed: [
    { id: 'demo-souless', name: '#Souless', iconUrl: null, memberCount: 69, manageUrl: '/demo/server/demo-souless', accessLabel: 'Owner View', ownerView: true, manageable: false, demo: true },
    { id: 'demo-auu', name: 'AUUUWW 💔', iconUrl: null, memberCount: 19, manageUrl: '/demo/server/demo-auu', accessLabel: 'Manage Server', ownerView: false, manageable: true, demo: true },
    { id: 'demo-monkeys', name: 'monkeys', iconUrl: null, memberCount: 3, manageUrl: '/demo/server/demo-monkeys', accessLabel: 'Manage Server', ownerView: false, manageable: true, demo: true },
    { id: 'demo-personal', name: 'Personal', iconUrl: null, memberCount: 11, manageUrl: '/demo/server/demo-personal', accessLabel: 'Manage Server', ownerView: false, manageable: true, demo: true },
  ],
  available: [
    { id: 'demo-invite-1', name: 'Preview Server', iconUrl: null, memberCount: 42, inviteUrl: '#', demo: true },
  ],
});

export const DEMO_CHANNELS = Object.freeze([
  { id: 'demo-ch-general', name: 'general', type: 'GUILD_TEXT' },
  { id: 'demo-ch-welcome', name: 'welcome', type: 'GUILD_TEXT' },
  { id: 'demo-ch-goodbye', name: 'goodbye', type: 'GUILD_TEXT' },
  { id: 'demo-ch-bye', name: 'bye', type: 'GUILD_TEXT' },
  { id: 'demo-ch-level-up', name: 'level-up', type: 'GUILD_TEXT' },
  { id: 'demo-ch-logs', name: 'logs', type: 'GUILD_TEXT' },
  { id: 'demo-ch-mod-logs', name: 'mod-logs', type: 'GUILD_TEXT' },
  { id: 'demo-ch-media', name: 'media', type: 'GUILD_TEXT' },
]);


export const DEMO_ROLES = Object.freeze([
  { id: 'demo-role-5', name: 'Lv5', editable: true, managed: false, position: 5 },
  { id: 'demo-role-10', name: 'Lv10', editable: true, managed: false, position: 10 },
  { id: 'demo-role-20', name: 'Lv20', editable: true, managed: false, position: 20 },
  { id: 'demo-role-vip', name: 'VIP', editable: true, managed: false, position: 30 },
  { id: 'demo-role-staff', name: 'Staff', editable: false, managed: false, position: 50 },
]);

export const DEMO_SERVER_SETTINGS = Object.freeze({
  welcome: {
    welcomeEnabled: true,
    goodbyeEnabled: true,
    welcomeChannelId: 'demo-ch-welcome',
    goodbyeChannelId: 'demo-ch-bye',
    welcomeMessage: 'WELCOME {user}\nTO\n{server}',
    goodbyeMessage: 'Goodbye {user}. We hope to see you again soon.',
  },
  leveling: {
    enabled: true,
    channelId: 'demo-ch-level-up',
    xpPerMessage: 15,
    cooldownSeconds: 60,
    stackRoles: true,
  },
  levelRewards: [
    { level: 5, roleId: 'demo-role-5', roleName: 'Lv5', exists: true },
    { level: 10, roleId: 'demo-role-10', roleName: 'Lv10', exists: true },
    { level: 20, roleId: 'demo-role-20', roleName: 'Lv20', exists: true },
  ],
  logs: {
    enabled: true,
    channelId: 'demo-ch-logs',
    messageEvents: false,
    memberEvents: true,
    moderationEvents: true,
    voiceEvents: false,
  },
  moderation: {
    enabled: false,
    warningsEnabled: true,
    automodEnabled: false,
    modLogChannelId: 'demo-ch-mod-logs',
    antiSpam: false,
    linkFilter: false,
    inviteFilter: false,
    blockedWords: '',
  },
});

export const DEMO_LEVELING = Object.freeze({
  rank: 3,
  level: 24,
  xp: 4820,
  nextLevelXp: 5400,
  leaderboard: [
    { username: 'Rafa', level: 24, xp: 4820 },
    { username: 'Luna', level: 21, xp: 4310 },
    { username: 'Milo', level: 19, xp: 3905 },
  ],
});

export const DEMO_IMAGE_ACCESS = Object.freeze({
  ok: true,
  users: [
    { id: '111111111111111111', username: 'Rafa', label: 'Rafa', addedAt: 'Demo data' },
    { id: '222222222222222222', username: 'Trusted Tester', label: 'Trusted Tester', addedAt: 'Demo data' },
  ],
  demo: true,
});

export function isDemoRoute(pathname = window.location.pathname) {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

export function demoServerById(id) {
  const server = DEMO_DASHBOARD.installed.find((guild) => guild.id === id) || DEMO_DASHBOARD.installed[0];
  return { ...server, manageUrl: `/demo/server/${server.id}`, channels: DEMO_CHANNELS.map((channel) => ({ ...channel })), demo: true };
}
