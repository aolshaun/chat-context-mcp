/**
 * Simple test to verify platform detection
 */

import { getPlatformInfo } from '../src/core/platform.js';

console.log('='.repeat(80));
console.log('Cursor Context - Platform Detection Test');
console.log('='.repeat(80));

const info = getPlatformInfo();

console.log('\nPlatform Information:');
console.log('  Platform:', info.platform);
console.log('  Cursor DB Path:', info.cursorDBPath);
console.log('  Metadata DB Path:', info.metadataDBPath);
console.log('  Cursor DB Exists:', info.cursorDBExists ? '✓ Yes' : '✗ No');

if (!info.cursorDBExists) {
  console.log('\n⚠️  Warning: Cursor database not found!');
  console.log('   Make sure Cursor is installed and you have used it at least once.');
} else {
  console.log('\n✓ Success: Cursor database found!');
}

console.log('\n' + '='.repeat(80));

