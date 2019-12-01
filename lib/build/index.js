const { promisify } = require('util')
const assert = require('assert')
const { resolve } = require('path')
let { writeFile } = require('fs')
writeFile = promisify(writeFile)
const DIST_DIR_PATH = 'dist'

/**
 * @module build
 */

/**
 * The Build class
 * @class
 */
class Build {
  /**
   * Create an instance of Application class
   *
   * @param {Object} config the build config options
   * @param {Object} config.distPath the package.json path for dist
   * @param {Application} app the application instance
   */
  constructor ({ distPath = DIST_DIR_PATH }, app) {
    assert.strictEqual(typeof distPath, 'string', 'distPath MUST_BE_STRING')
    this.distPackagePath = resolve(distPath, 'package.json')
    this.pkgObj = require(this.distPackagePath)
    this.throwError = app.throwError.bind(app)
  }

  /**
   * The function to build package.json for builds
   *
   * @param {Object} pkgObj the pkg object of package.json
   */
  async pkg (pkgObj) {
    const pkg = pkgObj || this.pkgObj
    delete pkg.devDependencies
    delete pkg.scripts
    pkg.scripts = { start: 'node lib/bin.js' }
    pkg.bin = { [pkg.name]: 'lib/bin.js' }
    return writeFile(this.distPackagePath, JSON.stringify(pkg, undefined, 2) + '\n')
  }

  /**
   * Start the build based on argument
   *
   * @returns {Promise} the promise about build finish
   */
  start () {
    switch (this._argv.obj) {
      case 'pkg':
        return this.pkg()
      default:
        this.throwError('INVALID_BUILD_PARAMETER')
    }
  }

  /**
   * Save cli arguments
   *
   * @param {Object} argv the object recieved from yargs .argv
   */
  setArgv (argv) {
    this.buildOb = argv.buildOb
  }

  /**
   * Set cli flags and commands
   *
   * @param {Yargs} yargs the instance of yargs
   */
  setCli (yargs) {
    yargs.command('build [obj]',
      'Build files for your repo.',
      (yargs) => {
        return yargs.positional('obj', {
          type: 'string',
          describe: 'What\'s to be built?\neg. for package.json pass pkg',
          default: 'pkg'
        })
      }
    )
    this._argv = yargs.argv
  }
}

module.exports = Build
