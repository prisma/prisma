#!/usr/bin/env node
import process from 'node:process';
import { runOrmCli } from './orm/cli';

process.exitCode = await runOrmCli(process);
