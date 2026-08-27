import "./global.css";
import { AppRegistry, LogBox } from "react-native";

/**
 * Boot guard.
 *
 * The router's ErrorBoundary can only catch a crash that happens while a screen
 * renders. Anything that throws while the modules below are still loading dies
 * before React exists, so nothing is ever registered and the native splash
 * stays up forever — the "blank screen on boot" with no way to read the error.
 *
 * Loading them by hand lets us catch that case and put the message on screen.
 */
function registerBootErrorScreen(error: unknown): void {
  const React = require("react");
  const { ScrollView, Text, View } = require("react-native");

  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? "(no stack)"}`
      : String(error);

  try {
    require("expo-splash-screen").hideAsync().catch(() => {});
  } catch {
    // expo-splash-screen itself may be what failed; nothing else to do.
  }

  AppRegistry.registerComponent("main", () => function BootErrorScreen() {
    return React.createElement(
      View,
      { style: { flex: 1, backgroundColor: "#0B1B33", padding: 24, paddingTop: 72 } },
      React.createElement(
        Text,
        { style: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 8 } },
        "The app could not start"
      ),
      React.createElement(
        Text,
        { style: { color: "#93a4c0", fontSize: 14, marginBottom: 20 } },
        "Show this screen to your developer."
      ),
      React.createElement(
        ScrollView,
        { style: { flex: 1 } },
        React.createElement(
          Text,
          { style: { color: "#f4f4f5", fontSize: 12, fontFamily: "monospace" } },
          detail
        )
      )
    );
  });
}

try {
  // First, before anything else can throw: an error from a timer or an
  // unawaited promise closes the app outright in a release build, and this
  // is what turns that into a recorded message instead of a vanishing act.
  require("./src/lib/crash-guard").installCrashGuard();

  require("react-native-get-random-values");
  require("react-native-reanimated");
  require("expo-router/entry");
  LogBox.ignoreLogs(["Expo AV has been deprecated", "Disconnected from Metro"]);
} catch (error) {
  console.error("[Boot] Startup failed:", error);
  registerBootErrorScreen(error);
}
