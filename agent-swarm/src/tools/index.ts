// Built-in Tools for Agents

import type { Tool, ToolResult } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: {
    path: { type: 'string', description: 'Path to the file', required: true },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.path as string;
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Failed to read file'
      };
    }
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file',
  parameters: {
    path: { type: 'string', description: 'Path to the file', required: true },
    content: { type: 'string', description: 'Content to write', required: true },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const filePath = params.path as string;
      const content = params.content as string;

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');

      return { success: true, output: `File written: ${filePath}` };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Failed to write file'
      };
    }
  },
};

export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List files in a directory',
  parameters: {
    path: { type: 'string', description: 'Directory path', required: true },
    recursive: { type: 'boolean', description: 'List recursively', required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const dirPath = params.path as string;
      const recursive = params.recursive as boolean;

      const files = await fs.readdir(dirPath, { withFileTypes: true, recursive });
      const fileList = files.map(f => f.isDirectory() ? `${f.name}/` : f.name);

      return { success: true, output: fileList.join('\n') };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Failed to list files'
      };
    }
  },
};

export const runCommandTool: Tool = {
  name: 'run_command',
  description: 'Execute a shell command',
  parameters: {
    command: { type: 'string', description: 'Command to execute', required: true },
    cwd: { type: 'string', description: 'Working directory', required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const command = params.command as string;
      const cwd = params.cwd as string | undefined;

      const { stdout, stderr } = await execAsync(command, { cwd });

      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Command failed'
      };
    }
  },
};

export const searchCodeTool: Tool = {
  name: 'search_code',
  description: 'Search for a pattern in files',
  parameters: {
    pattern: { type: 'string', description: 'Search pattern (regex)', required: true },
    path: { type: 'string', description: 'Directory to search', required: true },
    filePattern: { type: 'string', description: 'File glob pattern (e.g., *.ts)', required: false },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const pattern = params.pattern as string;
      const searchPath = params.path as string;
      const filePattern = params.filePattern as string || '*';

      // Use grep or findstr depending on platform
      const isWindows = process.platform === 'win32';
      const command = isWindows
        ? `findstr /s /n /r "${pattern}" "${searchPath}\\${filePattern}"`
        : `grep -rn "${pattern}" "${searchPath}" --include="${filePattern}"`;

      const { stdout } = await execAsync(command);
      return { success: true, output: stdout };
    } catch (error) {
      // grep returns exit code 1 when no matches found
      if (error instanceof Error && error.message.includes('exit code 1')) {
        return { success: true, output: 'No matches found' };
      }
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  },
};

// Export all tools as a collection
export const defaultTools: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runCommandTool,
  searchCodeTool,
];
