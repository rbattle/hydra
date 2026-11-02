import {
  EventMapCore,
  NavigationRoute,
  StackNavigationState,
  EventListenerCallback,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import {
  NativeStackHeaderItem,
  NativeStackNavigationEventMap,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import {
  createContext,
  MutableRefObject,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from "react";
import { Animated, Dimensions, TouchableOpacity } from "react-native";

import { StackParamsList } from "../app/stack";
import { GesturesContext } from "./SettingsContexts/GesturesContext";
import { ThemeContext } from "./SettingsContexts/ThemeContext";
import { IS_LIQUID_GLASS } from "../utils/liquidGlass";
import { releaseSnapshot, retainSnapshot } from "../utils/screenSnapshots";

/** Screens whose headerLeft the forward button would replace. */
const ROUTES_WITH_OWN_HEADER_LEFT = new Set<keyof StackParamsList>([
  "UserPage",
]);

type HandleBeforeRemoveType = EventListenerCallback<
  NativeStackNavigationEventMap &
    EventMapCore<StackNavigationState<StackParamsList>>,
  "beforeRemove",
  true
>;

type StackFutureProviderProps = PropsWithChildren<{
  futureRoutes: MutableRefObject<
    NavigationRoute<StackParamsList, keyof StackParamsList>[]
  >;
}>;

export const StackFutureContext = createContext({
  clearFuture: () => {},
  setVerticalBarItems: (_items: NativeStackHeaderItem[] | null) => {},
});

export function StackFutureProvider({
  children,
  futureRoutes,
}: StackFutureProviderProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<StackParamsList>>();
  const route = useRoute();

  const windowWidth = useRef(Dimensions.get("window").width);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);

  const { theme } = useContext(ThemeContext);
  const { showForwardButton } = useContext(GesturesContext);

  const handleBeforeRemove: HandleBeforeRemoveType = (e) => {
    // A reset replaces the stack, so its removed routes aren't somewhere to go forward to
    if (e.data.action.type === "RESET") {
      clearFuture();
      return;
    }
    const popped = navigation.getState().routes.slice(-1)[0];
    futureRoutes.current.push(popped);
    retainSnapshot(popped.key);
  };

  const clearFuture = () => {
    futureRoutes.current.forEach((route) => releaseSnapshot(route.key));
    futureRoutes.current = [];
  };

  useEffect(() => {
    navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      navigation.removeListener("beforeRemove", handleBeforeRemove);
    };
  }, [navigation]);

  const goForward = () => {
    const popped = futureRoutes.current.pop();
    if (!popped) return false;
    // restoreKey lets the new screen pick up the popped one's snapshot
    navigation.push(
      popped.name as any,
      { ...popped.params, restoreKey: popped.key } as any,
    );
    return true;
  };

  /**
   * A forward button next to the back button whenever there's a screen to go
   * forward to. It's also the only way forward on the iPhone Duo, whose
   * vertical bar covers the screen edge the forward swipe starts from.
   */
  // Items a page puts in the vertical bar (e.g. split view's) replace the forward button
  const pageItems = useRef<NativeStackHeaderItem[] | null>(null);
  const updateHeaderLeftItems = () => {
    const showForward = showForwardButton && futureRoutes.current.length > 0;
    if (IS_LIQUID_GLASS || pageItems.current) {
      const items =
        pageItems.current ??
        (showForward
          ? [
              {
                type: "button" as const,
                label: "Forward",
                icon: { type: "sfSymbol" as const, name: "chevron.forward" },
                onPress: goForward,
              },
            ]
          : null);
      navigation.setOptions({
        headerBackVisible: items ? true : undefined,
        unstable_headerLeftItems: items ? () => items : undefined,
      });
    } else if (
      !ROUTES_WITH_OWN_HEADER_LEFT.has(route.name as keyof StackParamsList)
    ) {
      // headerLeft replaces the back button, so headerBackVisible keeps it
      navigation.setOptions({
        headerBackVisible: showForward || undefined,
        unstable_headerLeftItems: undefined,
        headerLeft: !showForward
          ? undefined
          : () => (
              <TouchableOpacity
                accessibilityLabel="Forward"
                hitSlop={10}
                onPress={goForward}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={30}
                  color={theme.iconOrTextButton}
                />
              </TouchableOpacity>
            ),
      });
    }
  };
  useEffect(() => {
    updateHeaderLeftItems();
    return navigation.addListener("focus", updateHeaderLeftItems);
  }, [navigation, showForwardButton]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener(
      "change",
      // We shouldn't have to type this as any. For some reason, the React Native library removed the types for this event
      (event: any) => (windowWidth.current = event.window.width),
    );
    return () => subscription.remove();
  }, []);

  return (
    <StackFutureContext.Provider
      value={{
        clearFuture,
        setVerticalBarItems: (items) => {
          pageItems.current = items;
          updateHeaderLeftItems();
        },
      }}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
        }}
        onStartShouldSetResponderCapture={(e) => {
          gestureStart.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
          return false;
        }}
        onMoveShouldSetResponder={() =>
          !!gestureStart.current &&
          windowWidth.current - gestureStart.current.x < 30 &&
          futureRoutes.current.length > 0
        }
        onResponderMove={(e) => {
          if (!gestureStart.current) return false;
          const deltaX = gestureStart.current.x - e.nativeEvent.pageX;
          const deltaY = e.nativeEvent.pageY - gestureStart.current.y;
          const angleDegrees = Math.abs(
            Math.atan2(deltaY, deltaX) * (180 / Math.PI),
          );
          if (angleDegrees > 15 && deltaY > 30) {
            gestureStart.current = null;
            return false;
          }
          if (deltaX > 15 && angleDegrees < 15) {
            if (!goForward()) return false;
            gestureStart.current = null;
            return true;
          }
          return false;
        }}
      >
        {children}
      </Animated.View>
    </StackFutureContext.Provider>
  );
}
