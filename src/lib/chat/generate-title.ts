import { Message } from "../../types";

/**
 * Generates a descriptive title based on the first few messages in a chat.
 * 
 * @param messages Array of chat messages
 * @returns A generated title string (max 50 chars)
 */
export function generateChatTitle(messages: Message[]): string {
  // Default title if we can't generate one
  if (!messages.length) {
    return "New Chat";
  }

  // Find the first user message
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  
  if (!firstUserMessage) {
    return "New Chat";
  }

  // Extract the first line or first few words
  let title = firstUserMessage.content;
  
  // If there's a line break, just take the first line
  if (title.includes('\n')) {
    title = title.split('\n')[0].trim();
  }
  
  // If it's still too long, truncate it
  if (title.length > 50) {
    // Try to break at a word boundary
    const truncated = title.substring(0, 47).trim();
    // Find the last space
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 30) {
      // If we can break at a reasonable word, do so
      title = truncated.substring(0, lastSpaceIndex) + '...';
    } else {
      // Otherwise just truncate with ellipsis
      title = truncated + '...';
    }
  }
  
  return title;
}