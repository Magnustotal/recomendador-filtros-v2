// Los valores los inyecta next.config.mjs en el build (package.json + fecha del build).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
export const LAST_UPDATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";
