// Over-the-air update settings.
//
// These live here rather than in app.json because app.json is managed by the
// build tooling. Expo reads app.json first and hands it to this file as
// `config`, so everything in app.json still applies — this only adds the
// EAS Update fields on top.
//
// Why it matters that this is committed: the desktop at C:\ArriveAlive gets
// reset to whatever is in Git on every update. Anything configured only on
// that machine is silently erased, and the next APK would build with no
// update system inside it — which looks fine right up until an OTA push
// reaches nothing.
//
// `appVersion` policy means an update only reaches builds with a matching
// `version` in app.json (currently 1.0.0). Bumping that version cuts every
// installed tablet off from future updates until they get a new APK.

const PROJECT_ID = '88345668-4646-4476-a710-363f23c94eed';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: PROJECT_ID,
    },
  },
  updates: {
    ...config.updates,
    url: `https://u.expo.dev/${PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
