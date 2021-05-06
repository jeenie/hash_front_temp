/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { interpolateName } from 'loader-utils';
import * as path from 'path';
import * as postcss from 'postcss';
import * as url from 'url';
import * as webpack from 'webpack';

function wrapUrl(url: string): string {
  let wrappedUrl;
  const hasSingleQuotes = url.indexOf('\'') >= 0;

  if (hasSingleQuotes) {
    wrappedUrl = `"${url}"`;
  } else {
    wrappedUrl = `'${url}'`;
  }

  return `url(${wrappedUrl})`;
}

export interface PostcssCliResourcesOptions {
  baseHref?: string;
  deployUrl?: string;
  resourcesOutputPath?: string;
  rebaseRootRelative?: boolean;
  /** CSS is extracted to a `.css` or is embedded in a `.js` file. */
  extracted?: boolean;
  filename: string;
  loader: webpack.loader.LoaderContext;
  emitFile: boolean;
}

async function resolve(
  file: string,
  base: string,
  resolver: (file: string, base: string) => Promise<string>,
): Promise<string> {
  try {
    return await resolver('./' + file, base);
  } catch {
    return resolver(file, base);
  }
}

export default postcss.plugin('postcss-cli-resources', (options: PostcssCliResourcesOptions | undefined) => {
  if (!options) {
    throw new Error('No options were specified to "postcss-cli-resources".');
  }

  const {
    deployUrl = '',
    baseHref = '',
    resourcesOutputPath = '',
    filename,
    loader,
    emitFile,
    extracted,
  } = options;

  const process = async (inputUrl: string, context: string, resourceCache: Map<string, string>) => {
    // If root-relative, absolute or protocol relative url, leave as is
    if (/^((?:\w+:)?\/\/|data:|chrome:|#)/.test(inputUrl)) {
      return inputUrl;
    }

    if (/^\//.test(inputUrl)) {
      return inputUrl;
    }

    // If starts with a caret, remove and return remainder
    // this supports bypassing asset processing
    if (inputUrl.startsWith('^')) {
      return inputUrl.substr(1);
    }

    const cacheKey = path.resolve(context, inputUrl);
    const cachedUrl = resourceCache.get(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    if (inputUrl.startsWith('~')) {
      inputUrl = inputUrl.substr(1);
    }

    const { pathname, hash, search } = url.parse(inputUrl.replace(/\\/g, '/'));
    const resolver = (file: string, base: string) => new Promise<string>((resolve, reject) => {
      loader.resolve(base, decodeURI(file), (err, result) => {
        if (err) {
          reject(err);

          return;
        }
        resolve(result);
      });
    });

    const result = await resolve(pathname as string, context, resolver);

    return new Promise<string>((resolve, reject) => {
      loader.fs.readFile(result, (err: Error, content: Buffer) => {
        if (err) {
          reject(err);

          return;
        }

        let outputPath = interpolateName(
          { resourcePath: result } as webpack.loader.LoaderContext,
          filename,
          { content },
        );

        if (resourcesOutputPath) {
          outputPath = path.posix.join(resourcesOutputPath, outputPath);
        }

        loader.addDependency(result);
        if (emitFile) {
          loader.emitFile(outputPath, content, undefined);
        }

        let outputUrl = outputPath.replace(/\\/g, '/');
        if (hash || search) {
          outputUrl = url.format({ pathname: outputUrl, hash, search });
        }

        if (deployUrl && !extracted) {
          outputUrl = url.resolve(deployUrl, outputUrl);
        }

        resourceCache.set(cacheKey, outputUrl);
        resolve(outputUrl);
      });
    });
  };

  return (root) => {
    const urlDeclarations: Array<postcss.Declaration> = [];
    root.walkDecls(decl => {
      if (decl.value && decl.value.includes('url')) {
        urlDeclarations.push(decl);
      }
    });

    if (urlDeclarations.length === 0) {
      return;
    }

    const resourceCache = new Map<string, string>();

    return Promise.all(urlDeclarations.map(async decl => {
      const value = decl.value;
      const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
      const segments: string[] = [];

      let match;
      let lastIndex = 0;
      let modified = false;

      // We want to load it relative to the file that imports
      const inputFile = decl.source && decl.source.input.file;
      const context = inputFile && path.dirname(inputFile) || loader.context;

      // tslint:disable-next-line:no-conditional-assignment
      while (match = urlRegex.exec(value)) {
        const originalUrl = match[1] || match[2] || match[3];
        let processedUrl;
        try {
          processedUrl = await process(originalUrl, context, resourceCache);
        } catch (err) {
          loader.emitError(decl.error(err.message, { word: originalUrl }).toString());
          continue;
        }

        if (lastIndex < match.index) {
          segments.push(value.slice(lastIndex, match.index));
        }

        if (!processedUrl || originalUrl === processedUrl) {
          segments.push(match[0]);
        } else {
          segments.push(wrapUrl(processedUrl));
          modified = true;
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < value.length) {
        segments.push(value.slice(lastIndex));
      }

      if (modified) {
        decl.value = segments.join('');
      }
    }));
  };
});