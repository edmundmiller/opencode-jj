#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const OPENCODE_COMMAND_DIR = join(homedir(), '.config', 'opencode', 'command')
const COMMANDS_SOURCE_DIR = join(__dirname, '..', 'commands')

function setup() {
  console.log('opencode-jj: Installing slash commands...\n')

  if (!existsSync(OPENCODE_COMMAND_DIR)) {
    mkdirSync(OPENCODE_COMMAND_DIR, { recursive: true })
    console.log(`Created: ${OPENCODE_COMMAND_DIR}`)
  }

  if (!existsSync(COMMANDS_SOURCE_DIR)) {
    console.error(`Error: Commands directory not found at ${COMMANDS_SOURCE_DIR}`)
    process.exit(1)
  }

  const commandFiles = readdirSync(COMMANDS_SOURCE_DIR).filter(f => f.endsWith('.md'))
  
  if (commandFiles.length === 0) {
    console.log('No command files found to install.')
    return
  }

  for (const file of commandFiles) {
    const source = join(COMMANDS_SOURCE_DIR, file)
    const target = join(OPENCODE_COMMAND_DIR, file)
    
    copyFileSync(source, target)
    console.log(`Installed: ${file} -> ${target}`)
  }

  console.log(`\n✓ Installed ${commandFiles.length} slash command(s)`)
  console.log('\nAvailable commands:')
  console.log('  /jj "description"  - Create a new JJ change and unlock editing')
  console.log('  /jj-push           - Push the current change to remote')
}

setup()
