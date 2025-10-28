/**
 * Sync Command
 */

import { Command } from 'commander';
import ora from 'ora';
import { CursorContext } from '../../core/index.js';
import { printError, printSuccess } from '../utils/output.js';
import type { SyncOptions } from '../types.js';

export function createSyncCommand(): Command {
  const cmd = new Command('sync');
  
  cmd
    .description('Sync sessions from Cursor database')
    .option('-l, --limit <number>', 'Maximum number of sessions to sync', '50')
    .action(async (options: SyncOptions) => {
      const spinner = ora('Syncing sessions from Cursor...').start();
      
      try {
        const api = new CursorContext();
        
        const limit = options.limit ? parseInt(options.limit.toString(), 10) : 50;
        const synced = await api.syncSessions(limit);
        
        spinner.stop();
        
        if (synced === 0) {
          printSuccess('No new sessions to sync (all up to date)');
        } else {
          printSuccess(`Synced ${synced} new session(s)`);
        }
        
        api.close();
      } catch (error: any) {
        spinner.stop();
        printError(error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}

