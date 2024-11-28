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

There is a `prepack` hook in `package.json` which prepares the plugin before publishing, so all you need to do is run:

```shell
npm publish
```

> **Note**: The [`files`](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#files) array in `package.json` specifies which files get published. If you rename files/directories or add files elsewhere, you may need to update it.