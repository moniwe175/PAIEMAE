export const appParams = {
  appId: import.meta.env.VITE_APP_ID || 'app-default',
  token: import.meta.env.VITE_APP_TOKEN || '',
  functionsVersion: 'v1',
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || '',
};

export default appParams;
