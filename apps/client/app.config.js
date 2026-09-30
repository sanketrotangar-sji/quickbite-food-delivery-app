// google-services.json is gitignored, so EAS will not upload it with the project.
// Pass it as a file environment variable named GOOGLE_SERVICES_JSON instead.
// Local builds fall back to ./google-services.json.
module.exports = ({ config }) => {
  const android = { ...(config.android ?? {}) };
  // Remote appVersionSource owns versionCode; avoid the EAS warning.
  delete android.versionCode;
  android.googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

  return {
    ...config,
    android,
  };
};
