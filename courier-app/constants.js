// export const ORIGIN = 'https://deliveryappserver-1.onrender.com';
// export const WS_URL = `${ORIGIN.replace('https', 'wss').replace('http', 'ws')}`;
// export const API_LOCATION = `${ORIGIN}/api/location`;
export const ORIGIN = 'https://deliveryappserver-eu.onrender.com';
export const WS_URL = ORIGIN.replace(/^http/, 'ws'); // меняет http -> ws и https -> wss
export const API_LOCATION = `${ORIGIN}/api/location`;

