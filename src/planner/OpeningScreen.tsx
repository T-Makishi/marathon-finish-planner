import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const BACKGROUND = require("../../assets/opening-background.jpg");
const LOGO = require("../../assets/run-to-chebis-logo-white.png");

/** The original opening plays once per launch and can always be skipped. */
export default function OpeningScreen({
  onFinish,
  backgroundUri,
}: {
  onFinish: () => void;
  backgroundUri?: string;
}) {
  const insets = useSafeAreaInsets();
  const [imageReady, setImageReady] = useState(false);
  const [customFailed, setCustomFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const x = useRef(new Animated.Value(-420)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const custom =
    backgroundUri &&
    /^(https?:|file:|data:image\/|blob:)/.test(backgroundUri) &&
    !customFailed;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    // A missing image or platform callback must never block the planner.
    const fallback = setTimeout(() => {
      if (mounted) {
        setImageReady(true);
        setReduceMotion((value) => value ?? false);
      }
    }, 1500);
    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!imageReady || reduceMotion === null) return;
    x.setValue(reduceMotion ? 0 : -420);
    opacity.setValue(reduceMotion ? 1 : 0);
    copyOpacity.setValue(reduceMotion ? 1 : 0);
    progress.setValue(0);
    const animation = reduceMotion
      ? null
      : Animated.sequence([
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(x, {
                toValue: 18,
                duration: 760,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(x, {
                toValue: -8,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(x, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(copyOpacity, {
              toValue: 1,
              duration: 260,
              useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 1,
              duration: 1120,
              useNativeDriver: false,
            }),
          ]),
        ]);
    animation?.start();
    if (reduceMotion) progress.setValue(1);
    const timer = setTimeout(onFinish, 2600);
    return () => {
      clearTimeout(timer);
      animation?.stop();
    };
  }, [imageReady, reduceMotion, onFinish, x, opacity, copyOpacity, progress]);

  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={onFinish}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="オープニング。タップしてアプリへ進む"
        onPress={onFinish}
        style={styles.screen}
      >
        <Image
          source={custom ? { uri: backgroundUri } : BACKGROUND}
          style={styles.image}
          resizeMode="cover"
          accessible={false}
          onLoad={() => setImageReady(true)}
          onError={() => {
            if (custom) setCustomFailed(true);
            else setImageReady(true);
          }}
        />
        <View style={styles.shade} />
        <View style={styles.center}>
          <Animated.Image
            source={LOGO}
            accessible={false}
            resizeMode="contain"
            style={[styles.logo, { opacity, transform: [{ translateX: x }] }]}
          />
          <Animated.Text style={[styles.copy, { opacity: copyOpacity }]}>
            関門時間から完走ペースを逆算
          </Animated.Text>
        </View>
        <View
          style={[styles.bottom, { bottom: Math.max(insets.bottom + 24, 40) }]}
        >
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.caption}>Preparing your race plan...</Text>
          <Text style={styles.skip}>タップでスキップ</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0d0c",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: "100%",
    height: "100%",
  },
  shade: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.54)",
  },
  center: { width: "100%", alignItems: "center", paddingHorizontal: 26 },
  logo: { width: "88%", maxWidth: 420, height: 124 },
  copy: {
    marginTop: 10,
    color: "#fff",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  bottom: { position: "absolute", left: 36, right: 36, alignItems: "center" },
  track: {
    width: "100%",
    maxWidth: 300,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.34)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#18a66b" },
  caption: {
    marginTop: 14,
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  skip: {
    marginTop: 8,
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
