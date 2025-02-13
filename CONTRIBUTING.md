# Contributing

This guide provides instructions for contributing to this nest module.

## Developing

### Local Setup

1. Fork and clone the repo.
1. Install the dependencies.

    ```shell
    npm install
    ```

### Scripts

#### `npm run build`

It will compile the TypeScript code from `src/` into JavaScript in `dist/`. These files are used in apps with bundlers when your plugin is imported. Types are placed in `/dist/types`.

#### `npm run lint` / `npm run fmt`

Check formatting and code quality, autoformat/autofix if possible.

This template is integrated with TSLint, Prettier. Using these tools is completely optional, but strives to have consistent code style and structure for easier cooperation.

## Publishing

Is handled by [release-it](https://github.com/release-it/release-it) the config is in [.release-it.json](.release-it.json)

To trigger a release the [release-workflow](https://github.com/evva-sfw/nest-mqtt/actions/workflows/release.yml) is run with the input of what type of release (patch|minor|major) (SEMVER). Then the CHANGELOG.md is updated npm package published and RELEASE page on github is created with the new tag.
