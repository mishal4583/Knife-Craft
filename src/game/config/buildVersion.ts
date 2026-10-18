/**
 * BUILD_VERSION — the release this build ships as. It matches the release
 * zip's name (`releases/KnifeCraft-Playgama-v<BUILD_VERSION>.zip`) and the
 * archive name on Playgama, and rides on every analytics event
 * (`game_version`) so the telemetry can compare one release with the next.
 * Raise it with each new release zip.
 */
export const BUILD_VERSION = "1.4.0";
