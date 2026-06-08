// components/anim/FreshHighlight.js
// Однократная мягкая подсветка карточки (для только что пришедших заказов).
// Накладывается поверх карточки тонким полупрозрачным цветом и плавно гаснет.

import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function FreshHighlight({ active, color }) {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!active) return;
        const anim = Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.delay(550),
            Animated.timing(opacity, { toValue: 0, duration: 750, useNativeDriver: true }),
        ]);
        anim.start();
        return () => anim.stop();
    }, [active]);

    if (!active) return null;

    return (
        <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: color, opacity }]}
        />
    );
}
