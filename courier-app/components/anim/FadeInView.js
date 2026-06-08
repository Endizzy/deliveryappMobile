// components/anim/FadeInView.js
// Плавное появление: лёгкий сдвиг вверх + проявление. С опциональным стаггером
// по index (для списков). Сдержанно и быстро.

import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export default function FadeInView({
    children,
    style,
    index = 0,
    offset = 10,
    duration = 260,
    staggerStep = 45,
    maxStagger = 8,
}) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const delay = Math.min(index, maxStagger) * staggerStep;
        const anim = Animated.timing(progress, {
            toValue: 1,
            duration,
            delay,
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, []);

    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [offset, 0],
    });

    return (
        <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
            {children}
        </Animated.View>
    );
}
