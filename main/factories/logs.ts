import { appendFileSync, copyFileSync, readdirSync, renameSync, rmSync } from 'fs';
import { join, parse } from 'path';

import { app, dialog, ipcMain } from 'electron';
import { type LogFile } from 'electron-log';
import { default as log } from 'electron-log/main';

import { ENVIRONMENT } from '../shared/constants/environment';

const MAX_LOG_FILES_TO_KEEP = 10;
const MAIN_LOG_FILE = 'polkadot-desktop.log';
type RendererLogLevel = 'debug' | 'info' | 'warn' | 'error';
const isRendererLogLevel = (value: unknown): value is RendererLogLevel =>
  value === 'debug' || value === 'info' || value === 'warn' || value === 'error';

type RendererConsolePayload = { level: unknown; values: unknown };
const isRendererConsolePayload = (value: unknown): value is RendererConsolePayload =>
  !!value && typeof value === 'object' && 'level' in value && 'values' in value;

export function setupLogger() {
  setupRendererConsoleLogCapture();

  if (ENVIRONMENT.IS_DEV) return;
  log.initialize({ preload: true });
  log.variables['version'] = process.env['VERSION'];
  log.variables['env'] = import.meta.env.MODE;
  log.transports.console.format = '{y}/{m}/{d} {h}:{i}:{s}.{ms} [{env}#{version}]-{processType} [{level}] > {text}';
  log.transports.console.useStyles = true;

  log.transports.file.fileName = MAIN_LOG_FILE;
  log.transports.file.format = '{y}/{m}/{d} {h}:{i}:{s}.{ms} [{env}#{version}]-{processType} [{level}] > {text}';
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 1048576 * 5; // 5 MB;
  log.transports.file.archiveLogFn = rotateLogs;

  Object.assign(console, log.functions);
  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error }) {
      console.error('Uncaught error', error);
    },
  });
}

export function setupLogExport(): void {
  ipcMain.handle('exportLogs', exportLogs);
}

export async function exportLogs(): Promise<{ success: boolean }> {
  const logsDir = app.getPath('logs');

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Save logs to...',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || !filePaths[0]) return { success: false };

  const destination = filePaths[0];
  const files = readdirSync(logsDir).filter(f => f.endsWith('.log'));

  for (const file of files) {
    copyFileSync(join(logsDir, file), join(destination, file));
  }

  return { success: true };
}

function setupRendererConsoleLogCapture(): void {
  ipcMain.on('renderer:console-log', (_, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;

    if (!isRendererConsolePayload(payload)) return;

    const { level, values } = payload;
    if (!isRendererLogLevel(level) || !Array.isArray(values)) return;

    writeRendererLog(level, values);
  });
}

function writeRendererLog(level: RendererLogLevel, values: unknown[]): void {
  const mode = import.meta.env.MODE;
  const version = process.env['VERSION'] ?? 'unknown';
  const text = values.map(serializeRendererLogValue).join(' ');

  const message = `[${mode}#${version}]-renderer [${level}] > ${text}`;

  // In dev electron-log file transport is disabled, so we persist manually.
  if (ENVIRONMENT.IS_DEV) {
    const logsDir = app.getPath('logs');
    const filePath = join(logsDir, MAIN_LOG_FILE);
    const timestamp = new Date().toISOString();
    const line = `${timestamp} ${message}\n`;

    try {
      appendFileSync(filePath, line, 'utf8');
    } catch (error) {
      console.warn('Could not write renderer log', error);
    }
    return;
  }

  // In staging/prod we rely on electron-log to write + rotate the main file.
  switch (level) {
    case 'debug':
      log.debug(message);
      return;
    case 'info':
      log.info(message);
      return;
    case 'warn':
      log.warn(message);
      return;
    case 'error':
      log.error(message);
      return;
  }
}

function serializeRendererLogValue(value: unknown): string {
  if (value == null) return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function rotateLogs(oldLogFile: LogFile) {
  const file = oldLogFile.toString();
  const info = parse(file);
  const files = readdirSync(info.dir);

  if (files.length > MAX_LOG_FILES_TO_KEEP) {
    const filesToDelete = files.sort().slice(0, files.length - MAX_LOG_FILES_TO_KEEP);
    for (const fileToDelete of filesToDelete) {
      rmSync(join(info.dir, fileToDelete));
    }
  }
  try {
    const date = new Date().toISOString();
    const newFileName = join(info.dir, info.name + '.' + date + info.ext);
    renameSync(file, newFileName);
  } catch (error) {
    console.warn('Could not rotate log', error);
  }
}
