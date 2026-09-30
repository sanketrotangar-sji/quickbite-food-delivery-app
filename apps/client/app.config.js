// google-services.json is gitignored, so EAS will not upload it with the project.
// Pass it as a file environment variable named GOOGLE_SERVICES_JSON instead.
// Local/dev falls back to ./google-services.json when that file exists.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const android = { ...(config.android ?? {}) };
  // Remote appVersionSource owns versionCode; avoid the EAS warning.
  delete android.versionCode;

  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, 'google-services.json');
  const candidate =
    fromEnv && fs.existsSync(fromEnv)
      ? fromEnv
      : fs.existsSync(local)
        ? local
        : null;
  if (candidate) {
    android.googleServicesFile = candidate;
  } else {
    delete android.googleServicesFile;
  }

  return {
    ...config,
    android,
  };
};
