# @offliner/npm-package-filename
Tools for getting key data into and out of a package tarball filename

## Overview
The file-naming conventions implemented herein are peculiar to the purposes of the `@offliner/npm-downloadtracker` module and the `npm-two-stage` project.

The context is a directory (any nested directories are of no interest) in which multiple gzipped tar archive files (*tarballs*) are stored. Each filename would uniquely identify a specific version of a specific npm-installable package. The `@offliner/npm-downloadtracker` module provides the means to associate key data (e.g., package name and version) and arbitrary additional pieces of information (e.g., SHA sum, resolved URL) with a given filename; but in the event that the associated data is lost, it would be desirable to recover at least the key data from the filename, so that we don't need to extract the metadata from inside the tarball.

This module provides a function for making tarball filenames from key data, and one for parsing key data from filenames created by the former. The key data can identify a package from the npm registry, from a git repository, or a URL to a tarball. The filenames created through this module are always URL-safe, even when the embedded data are not.


## Install

```bash
npm install @offliner/npm-package-filename
````


## Usage

```js
const npf = require('@offliner/npm-package-filename')

npf.makeTarballName({
  type: 'semver',
  name: '@my-scope/my-package',
  version: '1.2.3-beta.4'
})
// --> '%40my-scope%2Fmy-package-1.2.3-beta.4.tar.gz'

npf.makeTarballName({
  type: 'git',
  domain: 'example.com',
  path: 'theUser/the-project',
  commit: 'abcdef1234567890abcdef1234567890abcdef12'
})
// --> 'example.com%2FtheUser%2Fthe-project%23abcdef1234567890abcdef1234567890abcdef12.tar.gz'

npf.parse('my-pkg-1.2.3-alpha.1%2B20130313144700.exp.sha.5114f85.tar.gz') /* -->
        {
          type: 'semver',
          packageName: 'my-pkg',
          versionComparable: '1.2.3-alpha.1',
          versionNumeric: '1.2.3',
          prerelease: 'alpha.1',
          build: '20130313144700.exp.sha.5114f85',
          extension: '.tar.gz'
        }
        */
npf.parse('example.com%2FtheUser%2Fthe-project%23abcdef1234567890abcdef1234567890abcdef12.tgz') /* -->
        {
          type: 'git',
          domain: 'example.com',
          path: 'theUser/the-project',
          repo: 'example.com/theUser/the-project',
          commit: 'abcdef1234567890abcdef1234567890abcdef12',
          extension: '.tgz'
        }
        */
npf.parse('my-package-1.2.3') // --> null -- missing tarball extension

npf.hasTarballExtension('my-package-1.2.3') // --> false
npf.hasTarballExtension('my-package-1.2.3.tar.gz') // --> true

npf.isVersionAmbiguous('my-package', '1.2.3') // --> false
npf.isVersionAmbiguous('my-package', '1.2.3-4.5.6') // --> true
```


## API

### `npf.makeTarballName(keyData)`
Creates a URL-safe tarball filename from the given key data.

Throws if any required property values are missing or invalid.

* `keyData` {object}
  * `type` {string} - `"semver"` || `"git"` || `"url"`

  Required with `type: "semver"`
  * `name` {string}
    The package name. Must be non-empty, but otherwise not validated.
  * `version` {string}
    A version string validated for compliance with Semantic Versioning 2.0.0.

  Required with `type: "git"`
  * `domain` {string}
    Must be non-empty, but otherwise not validated.
  * `path` {string}
    Must be non-empty, but otherwise not validated.
  * `commit` {string}
    A 40-hexadecimal-digit git commit hash. Validated.
  
  Required with `type: "url"`
  * `url` {string}
    A well-formed URL. Validated for protocol, host, and path.

* Returns: {string} A filename with a standard tarball extension.

### `npf.parse(filename)`
Extracts the key data from the given tarball filename.

Throws if no argument or not a string.

Returns null if `filename` does not match one of the patterns produced by `makeTarballName`.

* `filename` {string}
* Returns: {object || `null`}

  * `type` {string} - `"semver"` || `"git"` || `"url"`

  If `type` is `"semver"`:
  * `packageName` {string}
  * `versionComparable` {string}
    Numeric triplet, joined by hyphen to pre-release string if any.
  * `versionNumeric` {string}
    Numeric triplet only.
  * `prerelease` {string || `null`}
    Pre-release version.
  * `build` {string || `null`}
    Build metadata.
  * `extension` {string}
    The filename extension, `'.'`-prefixed.

  If `type` is `"git"`:
  * `domain` {string}
  * `path` {string}
  * `repo` {string}
    `domain + '/' + path`
  * `commit` {string}
    40-hexadecimal-digit git commit hash.
  * `extension` {string}
    The filename extension, `'.'`-prefixed.

  If `type` is `"url"`:
  * `url` {string}
    Will look like a relative path to a tarball. If `filename` is from a
    previous call to `makeTarballName`, then the first component is a domain,
    and the remainder is the path of the source URL.

### `npf.hasTarballExtension(str)`
Tells whether `str` has `'.tgz'` or `'.tar.gz'` or even `'.tar'` on the end.
Can take a filename, filepath, or URL.

Helpful if you need to check a string before you feed it to `parse`.

Throws if no argument or not a string.
* `str` {string}
* Returns: {boolean}

### `npf.isVersionAmbiguous(name[, version])`
npm registry package naming rules allow for names that include dotted numeric triplets, among other weird formations. If a version number is appended to that after a hyphen (as is done with tarballs in the npm registry), and you receive the result without the original context, you can't tell for sure where the package name ends and where the version string begins.

Semantic Versioning 2.0.0 allows for a pre-release string to start with a dotted numeric triplet, and that gets appended to the Major.Minor.Patch triplet after a hyphen. If such a concatenation gets appended to a package name after a hyphen, and you receive the result without the original context, again you have ambiguity that can only be resolved if you have either isolated piece of the source information.

This function takes such a concatenation, or a name and version to do the concatenation for you, and tells if the version cannot be extracted from it with certainty.

* `name` {string} a package name || `name + version` || `''`
* `version` {string} *Optional* An isolated version string
* Returns: {boolean}

It's important to understand that a full determination of ambiguity cannot be obtained without both a name and a version string. Even so, you can check a version string alone by passing it as the second argument, with an empty string as the first argument.

(If you pass a version string as the first and only argument, *the initial dotted numeric triplet will be interpreted as a package name*.)

If you want to check an already-concatenated name and version, pass it as the only argument.


## References
1. [**API documentation for `npm install`**](https://docs.npmjs.com/cli/v8/commands/npm-install) See *Tarball requirements*.
2. [**Semantic Versioning 2.0.0**](https://semver.org/)

------

**License: Artistic 2.0**
