
const expect = require('chai').expect
const npf = require('../')

// Test args to get TypeError thrown
const nonStringArgs = [ 42, true, [], {}, new Date() ]
const nonPOJOArgs = [ 'dummy', 42, true, [], new Date() ]
// Test args to get null returned from parse()
const notPackageFilenames = [
  '',
  'my-package.tar.gz',
  'my-package-1.2.tar.gz',
  'my-package-1.2.3.tar.gz.txt',
  'my-package-1.2.3-illegal?.tar.gz',
  'https://example.com/user/project/archive/1.2.3.tgz',
  'so-close-1.2.3',
  'my-package@6.6.6',
  'index.js',
  'package.json',
  'No way, Never.'
]
// This one actually is valid for a tarball of type 'url',
// because it's URI-encoded:
//  encodeURIComponent('my-package-1.2.3+BuildDate:1970-01-01T00:00:00Z.tar.gz'),

const nonVersions = [ '', '42', '1.2', '1.2.F', 'forty-two' ]
const prefixes = [
  '',
  'my-package-',
  'my-package.',
  'my-package@',
  'https://example.com/user/project/archive/'
]
// Examples of valid parts, mostly from semver.org
const parts = {
  preRelease: [ null, 'alpha', 'alpha.1', 'pre-alpha', '0.3.7', 'x.7.z.92', 'x-y-z.-' ],
  buildMeta: [ null, '001', '20130313144700', 'exp.sha.5114f85', '21AF26D3---117B344092BD' ]
}
const validExtensions = [ 'tar', 'tgz', 'tar.gz' ]
const NUMBER = '(?:0|[1-9]\\d*)'
const RE_NUMERIC_TRIPLET = new RegExp([ NUMBER, NUMBER, NUMBER ].join('\\.'))

function createUnambiguousVersionString(v, preIdx, buildIdx) {
  const pre = parts.preRelease[preIdx]
  const bld = parts.buildMeta[buildIdx]
  const signal = pre && RE_NUMERIC_TRIPLET.test(pre) ? '%25' : '-'
  return [
    signal, v,
    pre ? '-' + pre : '',
    bld ? '%2B' + bld : ''
  ].join('')
}

describe('npm-package-filename module', function() {
  it(
    'should export functions: parse, hasTarballExtension, isVersionAmbiguous, makeTarballName',
    function() {
      expect(npf.parse).to.be.a('function')
      expect(npf.hasTarballExtension).to.be.a('function')
      expect(npf.isVersionAmbiguous).to.be.a('function')
      expect(npf.makeTarballName).to.be.a('function')
    }
  )

  describe('parse()', function() {
    it('should throw a syntax error if given no argument', function() {
      expect(function(){ return npf.parse() }).to.throw(SyntaxError)
    })

    it('should throw a type error if given value is not a string', function() {
      for (let i = 0; i < nonStringArgs.length; ++i) {
        expect(function() {
          return npf.parse(nonStringArgs[i])
        }).to.throw(TypeError)
      }
    })

    it('should return null when input does not conform to package tarball naming', function() {
      for (let i = 0; i < notPackageFilenames.length; ++i) {
        const res = npf.parse(notPackageFilenames[i])
        if (res) console.log('i:', i, 'result:', res)
        expect(npf.parse(notPackageFilenames[i])).to.be.null
      }
    })

    it('should return a correctly-populated object when given a conforming filename of semver type', function() {
      const bases = [
        'my-package',
        '@my-scope/my-package'
      ]

      for (let b = 0; b < bases.length; ++b) {
        for (let i = 0; i < validExtensions.length; ++i) {
          const currExt = validExtensions[i]

          for (let j = 0; j < parts.preRelease.length; ++j) {
            const preRelVal = parts.preRelease[j]

            for (let k = 0; k < parts.buildMeta.length; ++k) {
              const buildMeta = parts.buildMeta[k]
              const filename = [
                encodeURIComponent(bases[b]),
                createUnambiguousVersionString('1.2.3', j, k),
                '.', currExt
              ].join('')
              const result = npf.parse(filename)
              try {expect(result).to.be.an('object')}
              catch (err) { console.log("parse problem with filename '"+filename+"'"); throw err }
              expect(result.type).to.be.a('string')
              try {expect(result.packageName).to.equal(bases[b])}
              catch (err) { console.log("parse problem with filename '"+filename+"'"); throw err }
              expect(result.versionComparable).to.equal('1.2.3' + (preRelVal ? '-'+preRelVal : ''))
              expect(result.versionNumeric).to.equal('1.2.3')
              if (preRelVal)
                expect(result.prerelease).to.equal(preRelVal)
              else
                expect(result.prerelease).to.be.null
              if (buildMeta)
                expect(result.build).to.equal(buildMeta)
              else
                expect(result.build).to.be.null
              expect(result.extension).to.equal('.' + currExt)
            }
          }
        }
      }
    })

    it('should return a correctly-populated object when given a conforming filename of type "git"', function() {
      const refData = {
        type: 'git',
        domain: 'example.com',
        path: 'username/project',
        commit: 'abcdef0123456789abcdef0123456789abcdef01',
        extension: '.tgz'
      }
      refData.repo = refData.domain + '/' + refData.path
      const raw = [ refData.repo, '#', refData.commit, refData.extension ].join('')
      const arg = encodeURIComponent(raw)
      const result = npf.parse(arg)
      expect(result).to.deep.equal(refData)
    })

    it('should return a correctly-populated object when given a conforming filename of type "url"', function() {
      const raw = 'example.com/username/project/archive/abc123.tgz'
      const arg = encodeURIComponent(raw)
      const result = npf.parse(arg)
      expect(result.type).to.equal('url')
      expect(result.url).to.equal(raw)
    })
  })

  describe('hasTarballExtension()', function() {
    it('should throw a syntax error if given no argument', function() {
      expect(function(){ return npf.hasTarballExtension() }).to.throw(SyntaxError)
    })

    it('should throw a type error if given value is not a string', function() {
      for (let i = 0; i < nonStringArgs.length; ++i) {
        expect(function() {
          return npf.hasTarballExtension(nonStringArgs[i])
        }).to.throw(TypeError)
      }
    })

    it ('should return false for a string that does not end in a tarball extension', function() {
      const testItems = [
        '',
        'my-package-1.2.3.tar.bz2',
        'my-package-1.2.3.tar.gz.txt',
        'index.js',
        'my-package@6.6.6'
      ]
      for (let i = 0; i < testItems.length; ++i)
        expect(npf.hasTarballExtension(testItems[i])).to.be.false
    })

    it ('should return true for a string that ends in a tarball extension', function() {
      const base = 'non-compliant-v42'
      for (let i = 0; i < validExtensions.length; ++i) {
        const str = base + '.' + validExtensions[i]
        expect(npf.hasTarballExtension(str)).to.be.true
      }
    })
  })

  describe('isVersionAmbiguous()', function() {
    it('should throw a syntax error if given no argument', function() {
      expect(function(){ return npf.isVersionAmbiguous() }).to.throw(SyntaxError)
    })

    it('should throw a type error if given value is not a string', function() {
      for (let i = 0; i < nonStringArgs.length; ++i) {
        expect(function() {
          return npf.isVersionAmbiguous(nonStringArgs[i])
        }).to.throw(TypeError)
      }
    })

    it ('should return false for input that does not contain a valid version string', function() {
      for (let i = 0; i < prefixes.length; ++i) {
        const pre = prefixes[i]
        for (let j = 0; j < nonVersions.length; ++j) {
          const notV = nonVersions[j]
          expect(npf.isVersionAmbiguous(pre + notV)).to.be.false
          expect(npf.isVersionAmbiguous(pre + notV + '.extension')).to.be.false
        }
      }
    })

    it ('should return true for input with ambiguous name + version combo', function() {
      const registryFilename = 'my-package-1.2.3-4.5.6.tgz'
      // Is that 'my-package' version '1.2.3-4.5.6' (valid semver), OR
      //         'my-package-1.2.3' version '4.5.6'?
      expect(npf.isVersionAmbiguous(registryFilename)).to.be.true
    })

    it ('should return false for input with unambiguous name + version combo', function() {
      for (let j = 0; j < parts.preRelease.length; ++j) {
        for (let k = 0; k < parts.buildMeta.length; ++k) {
          const filename = [
            'my-package',
            createUnambiguousVersionString('1.2.3', j, k),
            '.tar.gz'
          ].join('')

          expect(npf.isVersionAmbiguous(filename)).to.be.false
        }
      }
    })
  })

  const requiredProps = {
    semver: {
      name: 'my-package',
      version: '1.2.3'
    },
    git: {
      domain: 'github.com',
      path: 'myuser/my-project',
      commit: 'fedcba9876543210fedcba9876543210fedcba98'
    },
    url: {
      url: 'https://example.com/user/project/archive/123abc.tgz'
    }
  }

  describe('makeTarballName()', function() {
    it('should throw a syntax error if given no argument', function() {
      expect(function(){ return npf.makeTarballName() }).to.throw(SyntaxError)
      expect(function(){ return npf.makeTarballName(null) }).to.throw(SyntaxError)
      expect(function(){ return npf.makeTarballName(undefined) }).to.throw(SyntaxError)
    })

    it('should throw a type error if argument is not a plain object', function() {
      for (let i = 0; i < nonPOJOArgs.length; ++i) {
        expect(function() {
          return npf.makeTarballName(nonPOJOArgs[i])
        }).to.throw(TypeError)
      }
    })

    it('should throw a syntax error if object has no "type" property', function() {
      const data = { name: 'my-package', version: '1.2.3' }
      expect(function() {
        return npf.makeTarballName(data)
      }).to.throw(SyntaxError)
    })

    it('should throw a type error if "type" property is not a string', function() {
      const baseData = { name: 'my-package', version: '1.2.3' }
      for (let i = 0; i < nonStringArgs.length; ++i) {
        const argData = Object.assign({ type: nonStringArgs[i] }, baseData)
        expect(function() {
          return npf.makeTarballName(argData)
        }).to.throw(TypeError)
      }
    })

    it('should throw an error if value of "type" property not recognized', function() {
      const data = { type: 'nosuchtype', name: 'my-package', version: '1.2.3' }
      expect(function() {
        return npf.makeTarballName(data)
      }).to.throw('not recognized')
    })

    for (let type in requiredProps) {
      const props = Object.keys(requiredProps[type])

      it(`should throw a syntax error if missing any required properties for type "${type}"`, function() {
        for (let i = 0; i < props.length; ++i) {
          const propName = props[i]
          const argData = Object.assign({ type: type }, requiredProps[type])
          delete argData[propName]
          expect(function() {
            return npf.makeTarballName(argData)
          }).to.throw(SyntaxError)
        }
      })

      it(`should throw a type error for non-string value on any required property for type "${type}"`, function() {
        for (let i = 0; i < props.length; ++i) {
          const propName = props[i]
          const argData = Object.assign({ type: type }, requiredProps[type])
          for (let j = 0; j < nonStringArgs.length; ++j) {
            argData[propName] = nonStringArgs[j]
            expect(function() {
              return npf.makeTarballName(argData)
            }).to.throw(TypeError)
          }
        }
      })

      it(`should throw a syntax error for an empty string on any required property for type "${type}"`, function() {
        for (let i = 0; i < props.length; ++i) {
          const propName = props[i]
          const argData = Object.assign({ type: type }, requiredProps[type])
          argData[propName] = ''
          expect(function() {
            return npf.makeTarballName(argData)
          }).to.throw(SyntaxError)
        }
      })
    }

    it('should throw if data contains an invalid version string for type "semver"', function() {
      const argData = Object.assign({ type: 'semver' }, requiredProps.semver)
      for (let i = 0; i < nonVersions.length; ++i) {
        argData.version = nonVersions[i]
        expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
      }
    })

    it('should throw if data contains an invalid commit hash value for type "git"', function() {
      const argData = Object.assign({ type: 'git' }, requiredProps.git)
      argData.commit = argData.commit.slice(1)
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
      argData.commit += 'g'
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
      argData.commit = 'this_is_garbage'
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
    })

    it('should throw if url property has a bad value for type "url"', function() {
      const argData = { type: 'url', url: 'this is unacceptable' }
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
      argData.url = 'http:/\skincheckday.org.au//exr/brent.johnson@impacteddomain.com'
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
      argData.url = 'https://www.example.com'
      expect(function() { return npf.makeTarballName(argData) }).to.throw(Error)
    })

    for (let type in requiredProps) {
      const argData = Object.assign({ type: type }, requiredProps[type])
      const result = npf.makeTarballName(argData)
      it(`should return a non-empty string on correct input for type "${type}"`, function() {
        expect(result).to.be.a('string').that.is.not.empty
      })
      it(`return value should pass hasTarballExtension() for type "${type}"`, function() {
        expect(npf.hasTarballExtension(result)).to.be.true
      })
      it(`should return a value that parse()s correctly for type "${type}"`, function() {
        const revResult = npf.parse(result)
        expect(revResult).to.be.an('object')
        expect(revResult.type).to.be.a('string')
        expect(revResult.type).to.equal(type)

        const derived = {}
        switch (type) {
          case 'semver':
            expect(validExtensions.includes(revResult.extension.slice(1)))
            derived.name = revResult.packageName
            derived.version = revResult.versionComparable
                            + (revResult.build ? '+' + revResult.build : '')
            expect(npf.isVersionAmbiguous(derived.name, derived.version)).to.be.false
            break
          case 'git':
            expect(validExtensions.includes(revResult.extension.slice(1)))
            derived.domain = revResult.domain
            derived.path = revResult.path
            derived.commit = revResult.commit
            break
          case 'url':
            expect(revResult.url).to.be.a('string').that.is.not.empty
            derived.url = 'https://' + revResult.url
            break
        }
        expect(derived).to.deep.equal(requiredProps[type])
      })
    }
  })
})
