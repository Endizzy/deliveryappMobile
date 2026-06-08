// components/anim/PressableScale.js
// Кнопка/карточка с лёгким «вдавливанием» при нажатии (scale).
// Замена TouchableOpacity: тот же onPress/style API, но отклик через spring-scale.

import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({
    children,
    style,
    onPress,
    onLongPress,
    disabled = false,
    hitSlop,
    scaleTo = 0.97,
    ...rest
}) {
    const scale = useRef(new Animated.Value(1)).current;

    const animateTo = (value) => {
        Animated.spring(scale, {
            toValue: value,
            useNativeDriver: true,
            speed: 50,
            bounciness: 0,
        }).start();
    };

    return (
        <AnimatedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            disabled={disabled}
            hitSlop={hitSlop}
            onPressIn={() => animateTo(scaleTo)}
            onPressOut={() => animateTo(1)}
            style={[style, { transform: [{ scale }] }]}
            {...rest}
        >
            {children}
        </AnimatedPressable>
    );
}
