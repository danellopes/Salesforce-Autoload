#!/usr/bin/env node

const program = require('commander');
const package = require('./package.json');
const { autoload } = require('./autoload');

program.version(package.version);

program.command('init')
	.description('Inicia o processo de carga automática.')
	.action(() => autoload(program));

program.parse(process.argv);
