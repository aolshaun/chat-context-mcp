/**
 * Tests for workspace extraction
 */

import { describe, it, expect } from 'vitest';
import {
  getProjectName,
  extractWorkspacePath,
  extractAllWorkspacePaths,
  hasProject,
  isMultiWorkspace,
  getWorkspaceInfo,
  parseToolResult
} from '../../src/core/workspace-extractor.js';
import type { BubbleData } from '../../src/core/types.js';

describe('Workspace Extractor', () => {
  describe('getProjectName', () => {
    it('should extract project name from Unix path', () => {
      expect(getProjectName('/Users/me/projects/my-app')).toBe('my-app');
      expect(getProjectName('/home/user/code/awesome-project')).toBe('awesome-project');
    });
    
    it('should handle trailing slashes', () => {
      expect(getProjectName('/Users/me/projects/my-app/')).toBe('my-app');
      expect(getProjectName('/path/to/project///')).toBe('project');
    });
    
    it('should handle Windows paths', () => {
      expect(getProjectName('C:\\Users\\Me\\Projects\\MyApp')).toBe('MyApp');
      expect(getProjectName('D:\\Code\\project-name')).toBe('project-name');
    });
    
    it('should handle edge cases', () => {
      expect(getProjectName('/')).toBe('unknown');
      expect(getProjectName('')).toBe('unknown');
      expect(getProjectName('project-only')).toBe('project-only');
    });
  });
  
  describe('parseToolResult', () => {
    it('should extract workspace from tool result with workspaceResults', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          result: JSON.stringify({
            success: {
              workspaceResults: {
                '/Users/test/my-project': {
                  content: { matches: [] }
                }
              }
            }
          })
        }
      };
      
      const result = parseToolResult(bubble);
      expect(result).not.toBeNull();
      expect(result?.path).toBe('/Users/test/my-project');
      expect(result?.source).toBe('tool_result');
    });
    
    it('should handle bubbles without tool data', () => {
      const bubble: BubbleData = {
        type: 1,
        bubbleId: 'test-bubble',
        text: 'Some user message'
      };
      
      const result = parseToolResult(bubble);
      expect(result).toBeNull();
    });
    
    it('should handle tool results without workspaceResults', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          result: JSON.stringify({
            success: {
              someOtherData: 'value'
            }
          })
        }
      };
      
      const result = parseToolResult(bubble);
      expect(result).toBeNull();
    });
    
    it('should handle invalid JSON in tool result', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          result: 'not valid json {'
        }
      };
      
      const result = parseToolResult(bubble);
      expect(result).toBeNull();
    });
    
    it('should handle multiple workspaces in result', () => {
      const bubble: BubbleData = {
        type: 2,
        bubbleId: 'test-bubble',
        toolFormerData: {
          tool: 41,
          name: 'grep',
          result: JSON.stringify({
            success: {
              workspaceResults: {
                '/Users/test/project-1': {},
                '/Users/test/project-2': {}
              }
            }
          })
        }
      };
      
      const result = parseToolResult(bubble);
      expect(result).not.toBeNull();
      // Should return first one
      expect(['/Users/test/project-1', '/Users/test/project-2']).toContain(result?.path);
    });
  });
  
  describe('extractWorkspacePath', () => {
    it('should extract workspace from first bubble with tool result', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'User message'
        },
        {
          type: 2,
          bubbleId: 'b2',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/my-project': {}
                }
              }
            })
          }
        }
      ];
      
      const path = extractWorkspacePath(bubbles);
      expect(path).toBe('/Users/test/my-project');
    });
    
    it('should return null if no workspace found', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'User message'
        },
        {
          type: 2,
          bubbleId: 'b2',
          text: 'Assistant response'
        }
      ];
      
      const path = extractWorkspacePath(bubbles);
      expect(path).toBeNull();
    });
    
    it('should handle empty bubbles array', () => {
      const path = extractWorkspacePath([]);
      expect(path).toBeNull();
    });
  });
  
  describe('extractAllWorkspacePaths', () => {
    it('should extract all unique workspace paths', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-1': {}
                }
              }
            })
          }
        },
        {
          type: 2,
          bubbleId: 'b2',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-2': {}
                }
              }
            })
          }
        },
        {
          type: 2,
          bubbleId: 'b3',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-1': {} // Duplicate
                }
              }
            })
          }
        }
      ];
      
      const paths = extractAllWorkspacePaths(bubbles);
      expect(paths).toHaveLength(2);
      expect(paths).toContain('/Users/test/project-1');
      expect(paths).toContain('/Users/test/project-2');
    });
    
    it('should return empty array if no workspaces found', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'User message'
        }
      ];
      
      const paths = extractAllWorkspacePaths(bubbles);
      expect(paths).toEqual([]);
    });
  });
  
  describe('hasProject', () => {
    it('should return true if session has workspace', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project': {}
                }
              }
            })
          }
        }
      ];
      
      expect(hasProject(bubbles)).toBe(true);
    });
    
    it('should return false if session has no workspace', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'General question'
        }
      ];
      
      expect(hasProject(bubbles)).toBe(false);
    });
  });
  
  describe('isMultiWorkspace', () => {
    it('should return true if session has multiple workspaces', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-1': {}
                }
              }
            })
          }
        },
        {
          type: 2,
          bubbleId: 'b2',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-2': {}
                }
              }
            })
          }
        }
      ];
      
      expect(isMultiWorkspace(bubbles)).toBe(true);
    });
    
    it('should return false if session has single workspace', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project': {}
                }
              }
            })
          }
        }
      ];
      
      expect(isMultiWorkspace(bubbles)).toBe(false);
    });
  });
  
  describe('getWorkspaceInfo', () => {
    it('should return complete workspace info for project session', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/my-awesome-project': {}
                }
              }
            })
          }
        }
      ];
      
      const info = getWorkspaceInfo(bubbles);
      expect(info.primaryPath).toBe('/Users/test/my-awesome-project');
      expect(info.projectName).toBe('my-awesome-project');
      expect(info.allPaths).toHaveLength(1);
      expect(info.hasProject).toBe(true);
      expect(info.isMultiWorkspace).toBe(false);
    });
    
    it('should return empty info for non-project session', () => {
      const bubbles: BubbleData[] = [
        {
          type: 1,
          bubbleId: 'b1',
          text: 'General question'
        }
      ];
      
      const info = getWorkspaceInfo(bubbles);
      expect(info.primaryPath).toBeNull();
      expect(info.projectName).toBeNull();
      expect(info.allPaths).toEqual([]);
      expect(info.hasProject).toBe(false);
      expect(info.isMultiWorkspace).toBe(false);
    });
    
    it('should handle multi-workspace session', () => {
      const bubbles: BubbleData[] = [
        {
          type: 2,
          bubbleId: 'b1',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-1': {}
                }
              }
            })
          }
        },
        {
          type: 2,
          bubbleId: 'b2',
          toolFormerData: {
            tool: 41,
            name: 'grep',
            result: JSON.stringify({
              success: {
                workspaceResults: {
                  '/Users/test/project-2': {}
                }
              }
            })
          }
        }
      ];
      
      const info = getWorkspaceInfo(bubbles);
      expect(info.allPaths).toHaveLength(2);
      expect(info.hasProject).toBe(true);
      expect(info.isMultiWorkspace).toBe(true);
      expect(info.primaryPath).not.toBeNull();
    });
  });
});

