const { promisify } = require('util')
const assert = require('assert')
const { join, resolve } = require('path')
const copyfiles = require('copyfiles')
const { remove } = require('fs-extra')
const { promises } = require('fs')

const writeFile = promises.writeFile
const mkdir = promises.mkdir
const chmod = promises.chmod
const cpR = promisify(copyfiles)
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
   * @param {Object} config.distPath the dir path for dist
   * @param {Object} config.srcPath the dir path for source
   * @param {String[]} config.copyFiles the files to copy from root dir
   * @param {Application} app the application instance
   */
  constructor ({
    distPath = DIST_DIR_PATH,
    srcPath = '.',
    copyFiles = ['package.json', '*.md']
  }, app) {
    assert.strictEqual(typeof distPath, 'string', 'distPath MUST_BE_STRING')
    assert.strictEqual(typeof srcPath, 'string', 'srcPath MUST_BE_STRING')
    assert.strictEqual(typeof copyFiles, 'object', 'copyFiles MUST_BE_ARRAY')
    this.distDir = distPath
    this.distPath = resolve(this.distDir)
    this.srcDir = srcPath
    this.srcPath = resolve(srcPath)
    this.copyFiles = copyFiles
    this.throwError = app.throwError.bind(app)
  }

  /**
   * To clear dist and create a new one
   *
   * @param {Object} [pkgObj] the pkg object of package.json
   *
   * @returns {Promise} the promise for writing the package.json
   */
  async pkg (pkgObj) {
    const distPackagePath = join(this.distPath, 'package.json')
    const pkg = pkgObj || require(distPackagePath)
    delete pkg.devDependencies
    delete pkg.scripts
    pkg.scripts = { start: 'node lib/bin.js' }
    pkg.bin = { [pkg.name]: 'lib/bin.js' }
    return writeFile(distPackagePath, JSON.stringify(pkg, undefined, 2) + '\n')
  }

  /**
   * Clearn the dist directory and creates a new one
   *
   * @returns {Promise} the promise about preparing dist dir
   */
  async prepareDist () {
    await remove(this.distPath)
    await mkdir(this.distPath)
    await cpR([...this.copyFiles, this.distDir])
    await cpR([join(this.srcDir, 'lib', '**/*.js'), this.distDir])
    await chmod(join(this.distPath, 'lib', 'bin.js'), 511)
  }

  /**
   * Start the build based on argument
   *
   * @returns {Promise} the promise about build finish
   */
  async start () {
    switch (this._argv.obj) {
      case 'all':
        await this.prepareDist()
        await this.pkg()
        break
      case 'pkg':
        await this.pkg()
        break
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
          describe: 'What\'s to be built? eg. for package.json pass pkg, all for everything',
          default: 'all'
        })
      }
    )
    this._argv = yargs.argv
  }
}

module.exports = Build
