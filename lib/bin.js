#!/usr/bin/env node

const yargs = require('yargs')

const Application = require('./index')
const pkg = Application.getConfigFromPkg()[Application.mainAppName]

let pkg
try {
  pkg = require('./package.json')
} catch (er) {
  if (er.code === 'MODULE_NOT_FOUND') {
    pkg = require('../package.json')
  } else {
    throw er
  }
}

const currYear = new Date().getFullYear()
const argv = yargs
  .scriptName(pkg.name)
  .count('verbose')
  .alias('v', 'verbose')
  .help('h')
  .alias('h', 'help')
  .boolean('f')
  .describe('f', 'Force the command execution.\nCAUTION: This will overwrite working dir changes.')
  .alias('f', 'force')
  .epilog(`Copyright ${currYear} ${pkg.author}`)
  .usage('Usage: $0 [options] [<command>=sync] [arguments]')
  .command(['sync', '$0'], `Sync and update your codebase as per ${pkg.name} standard.`)
  .command('init <name> <description> [keywords]',
    `Initilize your codebase as per ${pkg.name} standard.`, (yargs) => {
      yargs.positional('name', { type: 'string', describe: 'name of the repo' })
        .positional('description', { type: 'string', describe: 'Description of the repo' })
        .positional('keywords', {
          type: 'string',
          describe: 'Space separated keywords for the tool to be built.'
        })
    }
  )
  .command('start <label> <title> [version] [issuenumber]',
    'Start working on an issue', (yargs) => {
      yargs.positional('title', { type: 'string', describe: 'The title of the issue' })
        .positional('label', {
          type: 'string',
          desc: 'Label to be applied for issue.',
          choices: [
            'f', 'fix',
            'a', 'addition',
            'r', 'removal',
            'c', 'change'
          ]
        })
        .positional('version', { describe: 'The issue number for this title' })
        .positional('issuenumber', { describe: 'The issue number for this title' })
    }
  )
  .argv

const VERBOSE_LEVEL = argv.verbose

console.error = function ERROR () { VERBOSE_LEVEL >= 0 && console.log.apply(console, arguments) }
console.info = function INFO () { VERBOSE_LEVEL >= 1 && console.log.apply(console, arguments) }
console.log = function DEBUG () { VERBOSE_LEVEL >= 2 && console.log.apply(console, arguments) }

const app = Application.main(__dirname)

process.on('SIGINT', function () {
  process.stdout.write('Stopping ' + app.config.name + ' ...')
  app.stop().then(results => {
    const successExit = results.find(pm => pm.status !== 'fulfilled')
    process.exit(successExit ? 0 : 1)
  })
})
