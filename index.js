module.exports = {
  makeTarballName: makeTarballName,
  parse: parseFilename,
  hasTarballExtension: hasTarballExt,
  isVersionAmbiguous: isVersionAmbiguous
}

const path = require('path')
const url = require('url')

/*
Let c = successful capture array; then c[0] is entire match;
c[1] is the bare name;
c[2] is numeric triplet of version string;
c[3] is pre-release identifier(s);
c[4] is build metadata; and
c[5] is the (tarball) file extension, '.'-prefixed.

c[3] & c[4] are optional, so each may be undefined.
For successful parsing, the regular expressions are only meant to be applied
to filenames that have first been URI-decoded.
*/
const VERSION_SIG = '%' // A convention unique to this module
const VALID_NAME = '[a-zA-Z0-9~!*()\'-][a-zA-Z0-9~!*()\'_.-]*'
const NUMBER = '(?:0|[1-9]\\d*)'
const NAME_BEFORE_VERSION = [
  VALID_NAME, '(?:-(?:', NUMBER, '(?:\\.(?:', NUMBER,
  '\\.?)?)?|(?:[a-zA-Z~!*()\'_.]|', NUMBER,
  '(?:[a-zA-Z~!*()\'_]|\\.(?:[a-zA-Z~!*()\'_.]|', NUMBER,
  '(?:[a-zA-Z~!*()\'_]|\\.[a-zA-Z~!*()\'_.]))))[a-zA-Z0-9~!*()\'_.]*))*'
].join('')
const NUMERIC_TRIPLET = [ NUMBER, NUMBER, NUMBER ].join('\\.')
const PRERELEASE_ID = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)'
const SEMVER_PRERELEASE = [
  PRERELEASE_ID, '(?:\\.', PRERELEASE_ID, ')*'
].join('')
const SEMVER_BUILD = '[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*'
const COMMIT_HASH = '[0-9a-fA-F]{40}'
const TARBALL_EXT = '\\.[tT](?:[gG][zZ]|[aA][rR](?:\\.[gG][zZ])?)'
const RE_VALID_SEMVER = new RegExp([
  '^', NUMERIC_TRIPLET,
  '(?:-', SEMVER_PRERELEASE, ')?(?:\\+', SEMVER_BUILD, ')?$'
].join(''))
const RE_AMBIGUOUS_VERSION = new RegExp([
  '-', NUMERIC_TRIPLET, '-', NUMERIC_TRIPLET,
  '(?:[+-]|\\.', TARBALL_EXT, '$|$)?'
].join(''))
const RE_VERSION_SIG = new RegExp(VERSION_SIG)
const RE_STRICT_PKGFILENAME = new RegExp([
  '^((?:', VALID_NAME, ')|(?:@', VALID_NAME, '\\/', VALID_NAME, '))',
  VERSION_SIG, '(', NUMERIC_TRIPLET, ')',
  '(?:-(', SEMVER_PRERELEASE, '))?',
  '(?:\\+(', SEMVER_BUILD, '))?',
  '(', TARBALL_EXT, ')$'
].join(''))
const RE_LOOSE_PKGFILENAME = new RegExp([
  '^((?:', NAME_BEFORE_VERSION, ')|(?:@', VALID_NAME, '\\/', NAME_BEFORE_VERSION,
  '))-(', NUMERIC_TRIPLET, ')',
  '(?:-(', SEMVER_PRERELEASE, '))?',
  '(?:\\+(', SEMVER_BUILD, '))?',
  '(', TARBALL_EXT, ')$'
].join(''))
const RE_COMMIT_HASH = new RegExp([ '^', COMMIT_HASH, '$' ].join(''))
const RE_GITREPO_FILENAME = new RegExp([
  '^([^\\/]+)\\/([^#]+)#(', COMMIT_HASH, ')(', TARBALL_EXT, ')$'
].join(''))
const RE_TARBALL_EXT = new RegExp(TARBALL_EXT + '$')
const RE_INVALID_CHARS = /^[_.]|[#$^&+{}|:"<>?`=\[\]\\;,\/]/

function expectString(val, label) {
  if (val === undefined || val === null)
    throw new SyntaxError(`no ${label} given`)
  if (typeof val !== 'string')
    throw new TypeError(`${label} must be a string`)
}

function expectNonemptyString(val, label) {
  expectString (val, label)
  if (!val) throw new SyntaxError(`${label} must not be empty`)
}

function parseFilename(str) {
  expectString(str, 'argument')
  // The input should be URI-encoded,
  // so the only trouble characters allowed are '@' and '%'
  if (RE_INVALID_CHARS.test(str)) return null

  try {
    str = decodeURIComponent(str)
  }
  catch (err) { // malformed URI; probably invalid '%xx' sequence
    return null
  }
  let matches = RE_VERSION_SIG.test(str)
              ? RE_STRICT_PKGFILENAME.exec(str)
              : RE_AMBIGUOUS_VERSION.test(str) ? null : RE_LOOSE_PKGFILENAME.exec(str)
  if (matches) return {
    type: 'semver',
    packageName: matches[1],
    versionComparable: matches[2] + (matches[3] ? '-' + matches[3] : ''),
    versionNumeric: matches[2],
    prerelease: matches[3] || null,
    build: matches[4] || null,
    extension: matches[5]
  }

  matches = RE_GITREPO_FILENAME.exec(str)
  if (matches) return {
    type: 'git',
    domain: matches[1],
    path: matches[2],
    repo: matches[1] + '/' + matches[2],
    commit: matches[3],
    extension: matches[4]
  }

  matches = url.parse(str)
  if (matches.path) {
    matches = path.parse(matches.path)
    // This test does not assert that the input is an actual remote URL!
    // It just has to contain a path with a directory and the name of a file in it.
    if (matches.dir && matches.base) return {
      type: 'url',
      url: str
    }
  }

  return null
}

// Works with a tarball filename even if it doesn't conform to all
// package name rules implemented here.
function hasTarballExt(str) {
  expectString(str, 'argument')

  return RE_TARBALL_EXT.test(str)
}

function isVersionAmbiguous(name, version) {
  expectString(name, 'argument')
  if (version !== undefined) expectString(version, 'second argument')

  const str = version ? name + '-' + version : name
  return RE_AMBIGUOUS_VERSION.test(str)
}

function makeTarballName(data) {
  if (data === undefined || data === null)
    throw new SyntaxError('information required')
  if (typeof data !== 'object')
    throw new TypeError('argument must be an object')
  if (Object.getPrototypeOf(data) != Object.getPrototypeOf({}))
    throw new TypeError('argument must be a plain object')
  expectNonemptyString(data.type, 'type property')

  const defaultExt = '.tar.gz'
  let raw
  switch (data.type) {
    case 'semver':
      expectNonemptyString(data.name, 'name property')
      expectNonemptyString(data.version, 'version property')
      if (!RE_VALID_SEMVER.test(data.version))
        throw new Error('version is not valid by semver 2.0')
      if (isVersionAmbiguous(data.name, data.version))
        raw = [ data.name, '%', data.version, defaultExt ].join('')
      else
        raw = [ data.name, '-', data.version, defaultExt ].join('')
      break;
    case 'git':
      expectNonemptyString(data.domain, 'domain property')
      expectNonemptyString(data.path, 'path property')
      expectNonemptyString(data.commit, 'commit property')
      if (!RE_COMMIT_HASH.test(data.commit))
        throw new Error('commit is not a valid commit hash')
      raw = [
        data.domain, '/', data.path, '#', data.commit, defaultExt
      ].join('')
      break;
    case 'url':
      expectNonemptyString(data.url, 'url property')
      const u = url.parse(data.url)
      if (!(u.protocol && u.slashes && u.host && u.path) || u.path === '/' || u.href !== data.url)
        throw new Error('value given for url does not look usable')
      raw = u.host + u.path
      if (!hasTarballExt(raw)) raw += defaultExt
      break;
    default:
      throw new Error(`Type '${data.type}' not recognized`)
  }
  return encodeURIComponent(raw)
}
