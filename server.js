#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(name) {
    this.name = name;
    this.logLevel = process.env.LOG_LEVEL ? 
      logLevels[(process.env.LOG_LEVEL || 'INFO').toUpperCase()] : 
      logLevels.INFO;
  }

  log(level, message) {
    if (logLevels[level] <= this.logLevel) {
      const timestamp = new Date().toISOString();
      console.error(`${timestamp} - ${this.name} - ${level} - ${message}`);
    }
  }

  info(message) { this.log('INFO', message); }
  warn(message) { this.log('WARN', message); }
  error(message) { this.log('ERROR', message); }
  debug(message) { this.log('DEBUG', message); }
}

const logger = new Logger('jinreiyu-applescript-mcp');

async function executeAppleScript(code, timeout = 60) {
  // Create a temporary file for the AppleScript
  const tempPath = path.join(os.tmpdir(), `applescript_${Date.now()}.scpt`);
  
  try {
    // Write the AppleScript to the temporary file
    fs.writeFileSync(tempPath, code);
    
    // Execute the AppleScript
    return new Promise((resolve, reject) => {
      exec(`osascript "${tempPath}"`, { timeout: timeout * 1000 }, (error, stdout, stderr) => {
        // Clean up the temporary file
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          logger.warn(`Failed to delete temporary file: ${e.message}`);
        }
        
        if (error) {
          if (error.killed) {
            resolve(`AppleScript execution timed out after ${timeout} seconds`);
          } else {
            resolve(`AppleScript execution failed: ${stderr}`);
          }
        } else {
          resolve(stdout);
        }
      });
    });
  } catch (e) {
    return `Error executing AppleScript: ${e.message}`;
  }
}

async function main() {
  logger.info('Starting Jinreiyu AppleScript MCP server');
  
  try {
    // Create the server
    const server = new McpServer({
      name: 'Jinreiyu AppleScript MCP',
      version: '1.0.0'
    });
    
    // Define the tool
    server.tool(
      'applescript_execute',
      'Run AppleScript code to interact with Mac applications and system features. This tool can access and manipulate data in Notes, Calendar, Contacts, Messages, Mail, Finder, Safari, and other Apple applications. Common use cases include but not limited to: - Retrieve or create notes in Apple Notes - Access or add calendar events and appointments - List contacts or modify contact details - Search for and organize files using Spotlight or Finder - Get system information like battery status, disk space, or network details - Read or organize browser bookmarks or history - Access or send emails, messages, or other communications - Read, write, or manage file contents - Execute shell commands and capture the output',
      {
        code_snippet: z.string().describe('Multi-line appleScript code to execute'),
        timeout: z.number().optional().describe('Command execution timeout in seconds (default: 60)')
      },
      async ({ code_snippet, timeout = 60 }) => {
        logger.info(`Executing AppleScript with timeout ${timeout}s`);
        
        if (!code_snippet) {
          return {
            content: [{ type: 'text', text: 'Error: Missing code_snippet argument' }]
          };
        }
        
        try {
          const result = await executeAppleScript(code_snippet, timeout);
          return {
            content: [{ type: 'text', text: result }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );
    
    // Use STDIO transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('MCP server started and ready to receive requests');
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
main();
