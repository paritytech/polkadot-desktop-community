import { type ChatMessage, type MessageContent } from '@/domains/chat';

const truncateName = (name: string) => (name.length > 16 ? `${name.slice(0, 8)}...` : name);

export function getPlainText(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'richText':
      return content.text ?? '';
    case 'reply':
      return getPlainText(content.content);
    default:
      return '';
  }
}

export function getMessagePreview(message: ChatMessage) {
  switch (message.content.type) {
    case 'text':
      return message.content.text;
    case 'contactAdded':
      return 'Accepted the request';
    case 'leftChat':
      return `${truncateName(message.peer.name)} left the chat`;
    case 'reacted':
      return `${truncateName(message.peer.name)} reacted to your message`;
    case 'reactionRemoved':
      return `${truncateName(message.peer.name)} removed a reaction`;
    case 'reply':
      return message.content.content.type === 'text' ? message.content.content.text : 'Replied to message';
    case 'richText': {
      if (message.content.text) return message.content.text;
      const attachment = message.content.attachments?.[0];
      if (!attachment) return '';
      if (attachment.meta.type === 'image') return 'Photo';
      if (attachment.meta.type === 'video') return 'Video';
      return 'File';
    }
    case 'edit':
      return message.content.newContent.text ?? '';
    case 'custom':
      return 'Message';
    case 'transfer':
      return message.status.direction === 'outgoing' ? 'Sent funds' : 'Received funds';
    case 'callSignal':
      if (message.content.signal !== 'offer') return '';
      return message.content.purpose === 'video' ? 'Video call' : 'Voice call';
    default:
      return '';
  }
}

export type MessagePreviewAttachment = 'image' | 'video' | 'file' | null;

export function getMessagePreviewAttachment(message: ChatMessage): MessagePreviewAttachment {
  if (message.content.type !== 'richText') return null;
  const attachment = message.content.attachments?.[0];
  if (!attachment) return null;
  if (attachment.meta.type === 'image') return 'image';
  if (attachment.meta.type === 'video') return 'video';
  return 'file';
}

export function formatMessageDate(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatLastMessageDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return formatMessageDate(timestamp);
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

export type LatestEdit = {
  text: string;
  timestamp: number;
};

export function deriveLatestEdits(messages: ChatMessage[]): Map<string, LatestEdit> {
  const edits = new Map<string, LatestEdit>();

  for (const msg of messages) {
    if (msg.content.type !== 'edit') continue;

    const targetId = msg.content.messageId;
    const existing = edits.get(targetId);

    if (!existing || msg.timestamp > existing.timestamp) {
      edits.set(targetId, {
        text: msg.content.newContent.text ?? '',
        timestamp: msg.timestamp,
      });
    }
  }

  return edits;
}

export type EditHistoryEntry = {
  text: string;
  timestamp: number;
};

export type DiffPart = {
  type: 'unchanged' | 'added' | 'deleted';
  text: string;
};

export function computeTextDiff(oldText: string, newText: string): DiffPart[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const lcs = longestCommonSubsequence(oldTokens, newTokens);

  const result: DiffPart[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldTokens.length || newIndex < newTokens.length) {
    const oldToken = oldTokens[oldIndex];
    const newToken = newTokens[newIndex];
    const lcsToken = lcs[lcsIndex];

    if (lcsToken !== undefined && oldToken === lcsToken && newToken === lcsToken) {
      result.push({ type: 'unchanged', text: oldToken });
      oldIndex++;
      newIndex++;
      lcsIndex++;
    } else if (oldToken !== undefined && (lcsToken === undefined || oldToken !== lcsToken)) {
      result.push({ type: 'deleted', text: oldToken });
      oldIndex++;
    } else if (newToken !== undefined && (lcsToken === undefined || newToken !== lcsToken)) {
      result.push({ type: 'added', text: newToken });
      newIndex++;
    }
  }

  return mergeDiffParts(result);
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let currentWord = '';

  for (const char of text) {
    if (/[\s\p{P}]/u.test(char)) {
      if (currentWord) {
        tokens.push(currentWord);
        currentWord = '';
      }
      tokens.push(char);
    } else {
      currentWord += char;
    }
  }

  if (currentWord) {
    tokens.push(currentWord);
  }

  return tokens;
}

function longestCommonSubsequence(oldTokens: string[], newTokens: string[]): string[] {
  const oldCount = oldTokens.length;
  const newCount = newTokens.length;

  if (oldCount === 0 || newCount === 0) return [];

  const matrix: number[][] = Array.from({ length: oldCount + 1 }, () => Array<number>(newCount + 1).fill(0));

  for (let row = 1; row <= oldCount; row++) {
    const matrixRow = matrix[row];
    const matrixPrevRow = matrix[row - 1];
    if (!matrixRow || !matrixPrevRow) continue;

    for (let col = 1; col <= newCount; col++) {
      if (oldTokens[row - 1] === newTokens[col - 1]) {
        matrixRow[col] = (matrixPrevRow[col - 1] ?? 0) + 1;
      } else {
        matrixRow[col] = Math.max(matrixPrevRow[col] ?? 0, matrixRow[col - 1] ?? 0);
      }
    }
  }

  const lcs: string[] = [];
  let row = oldCount;
  let col = newCount;
  while (row > 0 && col > 0) {
    const matrixRow = matrix[row];
    const matrixPrevRow = matrix[row - 1];
    if (!matrixRow || !matrixPrevRow) break;

    const token = oldTokens[row - 1];
    if (token !== undefined && token === newTokens[col - 1]) {
      lcs.push(token);
      row--;
      col--;
    } else if ((matrixPrevRow[col] ?? 0) > (matrixRow[col - 1] ?? 0)) {
      row--;
    } else {
      col--;
    }
  }

  return lcs.reverse();
}

function mergeDiffParts(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];

  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) {
      last.text += part.text;
    } else {
      merged.push({ type: part.type, text: part.text });
    }
  }

  return merged;
}

export function getEditHistory(messages: ChatMessage[], targetMessageId: string): EditHistoryEntry[] {
  const entries: EditHistoryEntry[] = [];

  for (const msg of messages) {
    if (msg.content.type !== 'edit') continue;
    if (msg.content.messageId !== targetMessageId) continue;

    entries.push({
      text: msg.content.newContent.text ?? '',
      timestamp: msg.timestamp,
    });
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}
