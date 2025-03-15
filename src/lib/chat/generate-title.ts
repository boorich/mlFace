import { Message } from "../../types";

/**
 * Generates a descriptive title based on the conversation context.
 * 
 * @param messages Array of chat messages
 * @returns A generated title string (max 50 chars)
 */
export function generateChatTitle(messages: Message[]): string {
  // Default title if we can't generate one
  if (!messages.length) {
    return "New Chat";
  }

  // We need at least one user message and one assistant response for context
  const userMessages = messages.filter(msg => msg.role === 'user');
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  
  if (userMessages.length === 0) {
    return "New Chat";
  }

  // Get the first substantial user message (more than just a greeting)
  const firstUserMessage = userMessages[0].content;
  
  // If we have at least one assistant response, use that to help generate the title
  if (assistantMessages.length > 0) {
    // Try to generate a topic-based title by analyzing content
    return generateTopicBasedTitle(firstUserMessage, assistantMessages[0].content);
  }
  
  // If we only have the user message, extract a reasonable title from it
  return extractTitleFromMessage(firstUserMessage);
}

/**
 * Extracts a reasonable title from a single message
 */
function extractTitleFromMessage(message: string): string {
  // Remove common question starters to get to the point
  const cleanedMessage = message
    .replace(/^(can you|could you|please|hey|hi|hello|would you|i want to|i'd like to)/i, '')
    .trim();
  
  // If there's a question mark, take everything up to it
  if (cleanedMessage.includes('?')) {
    const question = cleanedMessage.split('?')[0] + '?';
    if (question.length <= 50) {
      return question;
    }
  }
  
  // If there's a line break, just take the first line
  if (cleanedMessage.includes('\n')) {
    const firstLine = cleanedMessage.split('\n')[0].trim();
    return truncateWithEllipsis(firstLine, 50);
  }
  
  // Otherwise, take a reasonable portion of the message
  return truncateWithEllipsis(cleanedMessage, 50);
}

/**
 * Generates a topic-based title by analyzing both the user input and assistant response
 */
function generateTopicBasedTitle(userMessage: string, assistantResponse: string): string {
  // Identify if this is a coding or technical conversation
  const technicalKeywords = /\b(code|javascript|python|react|node|api|function|class|component|html|css|typescript|sql|database|git|framework|library|programming)\b/i;
  const isTechnical = technicalKeywords.test(userMessage) || technicalKeywords.test(assistantResponse);
  
  // Identify if this is about explaining a concept
  const explanationKeywords = /\b(explain|what is|how does|definition of|meaning of|concept of|understand|tell me about)\b/i;
  const isExplanation = explanationKeywords.test(userMessage);
  
  // Identify if this is a creative or writing task
  const creativeKeywords = /\b(write|create|story|poem|essay|blog|article|script|creative|imagine|fiction)\b/i;
  const isCreative = creativeKeywords.test(userMessage);
  
  // Identify if this is a comparison or analysis
  const analysisKeywords = /\b(compare|versus|vs\.?|difference|similarities|analyze|analysis|review|evaluate|pros and cons)\b/i;
  const isAnalysis = analysisKeywords.test(userMessage);
  
  // Extract the main subject from user message
  const subject = extractSubject(userMessage);
  
  // Generate title based on the type of conversation
  if (isTechnical) {
    return truncateWithEllipsis(`${subject} - Code Help`, 50);
  } else if (isExplanation) {
    return truncateWithEllipsis(`Explaining: ${subject}`, 50);
  } else if (isCreative) {
    if (userMessage.toLowerCase().includes('story')) {
      return truncateWithEllipsis(`Story about ${subject}`, 50);
    } else if (userMessage.toLowerCase().includes('poem')) {
      return truncateWithEllipsis(`Poem about ${subject}`, 50);
    } else {
      return truncateWithEllipsis(`Writing: ${subject}`, 50);
    }
  } else if (isAnalysis) {
    return truncateWithEllipsis(`Analysis of ${subject}`, 50);
  } else {
    // Default to a cleaner version of the first message
    return extractTitleFromMessage(userMessage);
  }
}

/**
 * Attempts to extract the main subject from a message
 */
function extractSubject(message: string): string {
  // Remove common question starters
  let cleaned = message
    .replace(/^(can you|could you|please|hey|hi|hello|would you|i want to|i'd like to)/i, '')
    .replace(/^(write|create|explain|tell me about|what is|how does)/i, '')
    .trim();
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.?!]+$/, '');
  
  // If the subject is too long, take the first part
  if (cleaned.length > 40) {
    const words = cleaned.split(' ');
    let result = '';
    
    // Take words until we reach a reasonable length
    for (const word of words) {
      if ((result + ' ' + word).length <= 40) {
        result += (result ? ' ' : '') + word;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  return cleaned;
}

/**
 * Truncates text with ellipsis at word boundaries
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to break at a word boundary
  const truncated = text.substring(0, maxLength - 3).trim();
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.6) {
    // If we can break at a reasonable word, do so
    return truncated.substring(0, lastSpaceIndex) + '...';
  } else {
    // Otherwise just truncate with ellipsis
    return truncated + '...';
  }
}