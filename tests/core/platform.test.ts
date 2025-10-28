/**
 * Tests for platform detection
 */

import { describe, it, expect } from 'vitest';
import { getCursorDBPath, getProjectName, getPlatformInfo } from '../../src/core/platform.js';
import { getProjectName as getProjectNameFromWorkspace } from '../../src/core/workspace-extractor.js';

describe('Platform Detection', () => {
  it('should return a valid Cursor DB path', () => {
    const dbPath = getCursorDBPath();
    expect(dbPath).toBeTruthy();
    expect(dbPath).toContain('Cursor');
    expect(dbPath).toContain('state.vscdb');
  });

  it('should return platform info', () => {
    const info = getPlatformInfo();
    expect(info.platform).toBeTruthy();
    expect(info.cursorDBPath).toBeTruthy();
    expect(info.metadataDBPath).toBeTruthy();
    expect(typeof info.cursorDBExists).toBe('boolean');
  });
});

describe('Project Name Extraction', () => {
  it('should extract project name from path', () => {
    const path1 = '/Users/me/projects/my-app';
    expect(getProjectNameFromWorkspace(path1)).toBe('my-app');

    const path2 = '/home/user/code/awesome-project/';
    expect(getProjectNameFromWorkspace(path2)).toBe('awesome-project');
  });

  it('should handle edge cases', () => {
    const root = '/';
    expect(getProjectNameFromWorkspace(root)).toBeTruthy();
  });
});

