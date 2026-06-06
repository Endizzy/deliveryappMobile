
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_STORAGE_KEY = 'appTheme';

// dark theme
// const dark = {
//     mode: 'dark',
//     statusBar: 'light-content',

//     primary: '#2F8CFF',
//     accent: '#007AFF',

//     bg: '#010B13',
//     card: '#0B1722',
//     cardStrong: '#0F2232',
//     cardAlt: '#0F2232',
//     cardCompleted: '#08131d',
//     ghost: '#0B1722',
//     inputBg: '#0B1722',

//     surface: 'rgba(255, 255, 255, 0.04)',
//     surfaceSoft: 'rgba(255, 255, 255, 0.02)',
//     softGray: 'rgba(255, 255, 255, 0.03)',

//     text: '#FFFFFF',
//     muted: '#8FA3B8',
//     onPrimary: '#FFFFFF',
//     inputLabel: '#7F93A8',
//     placeholder: '#7E8A97',

//     line: 'rgba(255, 255, 255, 0.08)',
//     lineSoft: 'rgba(255, 255, 255, 0.06)',
//     lineStrong: 'rgba(255, 255, 255, 0.10)',

//     softBlue: 'rgba(47, 140, 255, 0.12)',
//     softBlueStrong: 'rgba(47, 140, 255, 0.18)',
//     softBlueBorder: 'rgba(47, 140, 255, 0.18)',

//     success: '#4ADE80',
//     danger: '#FF7B7B',
//     warning: '#FBBF24',
//     softGreen: 'rgba(74, 222, 128, 0.12)',
//     softGreenBorder: 'rgba(74, 222, 128, 0.20)',
//     softRed: 'rgba(255, 123, 123, 0.10)',
//     softRedBorder: 'rgba(255, 123, 123, 0.20)',

//     shadow: '#000',
//     circleTop: 'rgba(0, 122, 255, 0.12)',
//     circleBottom: 'rgba(0, 180, 255, 0.08)',

//     switchTrackOff: '#404854',
//     switchTrackOn: '#4ADE80',
//     switchThumbOn: '#2ecc71',
//     switchThumbOff: '#888',
// };

// dark theme — «Graphite Mono»: нейтральный серый графит без синего подтона,
// многоуровневые поверхности и небесно-синий акцент.
const dark = {
    mode: 'dark',
    statusBar: 'light-content',

    primary: '#5AA0FF',
    accent: '#3B82F6',

    bg: '#16181B',
    card: '#1F2227',
    cardStrong: '#272B31',
    cardAlt: '#272B31',
    cardCompleted: '#19211C',
    ghost: '#23272D',
    inputBg: '#23272D',

    surface: '#1F2227',
    surfaceSoft: 'rgba(255, 255, 255, 0.03)',
    softGray: 'rgba(255, 255, 255, 0.05)',

    text: '#EDEFF2',
    muted: '#9BA1AB',
    onPrimary: '#FFFFFF',
    inputLabel: '#9098A2',
    placeholder: '#6C737D',

    line: 'rgba(255, 255, 255, 0.09)',
    lineSoft: 'rgba(255, 255, 255, 0.06)',
    lineStrong: 'rgba(255, 255, 255, 0.14)',

    softBlue: 'rgba(90, 160, 255, 0.14)',
    softBlueStrong: 'rgba(90, 160, 255, 0.22)',
    softBlueBorder: 'rgba(90, 160, 255, 0.32)',

    success: '#4ADE80',
    danger: '#FF6B6B',
    warning: '#FBBF24',
    softGreen: 'rgba(74, 222, 128, 0.14)',
    softGreenBorder: 'rgba(74, 222, 128, 0.26)',
    softRed: 'rgba(255, 107, 107, 0.12)',
    softRedBorder: 'rgba(255, 107, 107, 0.26)',

    shadow: '#000000',
    circleTop: 'rgba(90, 160, 255, 0.12)',
    circleBottom: 'rgba(255, 255, 255, 0.04)',

    switchTrackOff: '#3A3F46',
    switchTrackOn: '#4ADE80',
    switchThumbOn: '#EAFBF0',
    switchThumbOff: '#C4CAD2',
};

// light theme
const light = {
    mode: 'light',
    statusBar: 'dark-content',

    primary: '#2F8CFF',
    accent: '#007AFF',

    bg: '#EEF2F7',
    card: '#FFFFFF',
    cardStrong: '#E9EFF6',
    cardAlt: '#E9EFF6',
    cardCompleted: '#EAF6EE',
    ghost: '#F1F5F9',
    inputBg: '#F4F7FA',

    surface: '#FFFFFF',
    surfaceSoft: 'rgba(0, 0, 0, 0.02)',
    softGray: 'rgba(0, 0, 0, 0.035)',

    text: '#0B1722',
    muted: '#5B6B7B',
    onPrimary: '#FFFFFF',
    inputLabel: '#5B6B7B',
    placeholder: '#9AA7B4',

    line: 'rgba(0, 0, 0, 0.10)',
    lineSoft: 'rgba(0, 0, 0, 0.07)',
    lineStrong: 'rgba(0, 0, 0, 0.12)',

    softBlue: 'rgba(47, 140, 255, 0.12)',
    softBlueStrong: 'rgba(47, 140, 255, 0.18)',
    softBlueBorder: 'rgba(47, 140, 255, 0.22)',

    success: '#16A34A',
    danger: '#E5484D',
    warning: '#D97706',
    softGreen: 'rgba(22, 163, 74, 0.12)',
    softGreenBorder: 'rgba(22, 163, 74, 0.22)',
    softRed: 'rgba(229, 72, 77, 0.10)',
    softRedBorder: 'rgba(229, 72, 77, 0.22)',

    shadow: '#9BB0C9',
    circleTop: 'rgba(0, 122, 255, 0.10)',
    circleBottom: 'rgba(0, 180, 255, 0.07)',

    switchTrackOff: '#C7D0DA',
    switchTrackOn: '#34C759',
    switchThumbOn: '#16A34A',
    switchThumbOff: '#F4F7FA',
};

export const PALETTES = { dark, light };

export function getColors(themeName) {
    return PALETTES[themeName] || light;// news default to light if something goes wrong
}

const ThemeContext = createContext({
    themeName: 'dark',
    colors: dark,
    setTheme: () => {},
    ready: true,
});

export function ThemeProvider({ children }) {
    const [themeName, setThemeName] = useState('dark');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (saved === 'light' || saved === 'dark') {
                    setThemeName(saved);
                }
            } catch (e) {
                // ignore — остаёмся на теме по умолчанию
            } finally {
                setReady(true);
            }
        })();
    }, []);

    const setTheme = useCallback((name) => {
        if (name !== 'light' && name !== 'dark') return;
        setThemeName(name);
        AsyncStorage.setItem(THEME_STORAGE_KEY, name).catch(() => {});
    }, []);

    const value = useMemo(
        () => ({
            themeName,
            colors: getColors(themeName),
            isDark: themeName === 'dark',
            setTheme,
            ready,
        }),
        [themeName, setTheme, ready]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
