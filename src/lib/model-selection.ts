import { Model } from '../types';

// Model capabilities categories
export type ModelTask = 
  | 'simple-chat' 
  | 'complex-reasoning' 
  | 'code-generation'
  | 'creative-writing'
  | 'summarization';

/**
 * Analyzes a message to determine the most appropriate model task
 */
export function analyzePrompt(prompt: string): ModelTask {
  // Convert to lowercase for easier pattern matching
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for code-related patterns
  if (
    lowerPrompt.includes('code') ||
    lowerPrompt.includes('program') ||
    lowerPrompt.includes('function') ||
    lowerPrompt.includes('algorithm') ||
    lowerPrompt.includes('programming') ||
    lowerPrompt.includes('developer') ||
    lowerPrompt.includes('javascript') ||
    lowerPrompt.includes('python') ||
    lowerPrompt.includes('java') ||
    lowerPrompt.includes('html') ||
    lowerPrompt.includes('css') ||
    lowerPrompt.includes('debug')
  ) {
    return 'code-generation';
  }
  
  // Check for creative writing patterns
  if (
    lowerPrompt.includes('write a story') ||
    lowerPrompt.includes('write a poem') ||
    lowerPrompt.includes('creative') ||
    lowerPrompt.includes('fiction') ||
    lowerPrompt.includes('novel') ||
    lowerPrompt.includes('poem') ||
    lowerPrompt.includes('story') ||
    lowerPrompt.includes('script') ||
    lowerPrompt.includes('narrative')
  ) {
    return 'creative-writing';
  }
  
  // Check for summarization patterns
  if (
    lowerPrompt.includes('summarize') ||
    lowerPrompt.includes('summary') ||
    lowerPrompt.includes('tldr') ||
    lowerPrompt.includes('main points') ||
    lowerPrompt.includes('key points') ||
    lowerPrompt.includes('condense')
  ) {
    return 'summarization';
  }
  
  // Check for complex reasoning patterns
  if (
    lowerPrompt.includes('explain') ||
    lowerPrompt.includes('analyze') ||
    lowerPrompt.includes('compare') ||
    lowerPrompt.includes('difference') ||
    lowerPrompt.includes('philosophy') ||
    lowerPrompt.includes('theory') ||
    lowerPrompt.includes('concept') ||
    lowerPrompt.includes('evaluate') ||
    lowerPrompt.includes('assessment') ||
    lowerPrompt.length > 100 // Longer prompts often require more reasoning
  ) {
    return 'complex-reasoning';
  }
  
  // Default to simple chat for everything else
  return 'simple-chat';
}

/**
 * Finds the best model for a specific task from available models
 */
export function findBestModelForTask(models: Model[], task: ModelTask): Model | null {
  if (models.length === 0) {
    return null;
  }
  
  // Model preferences based on common naming patterns
  // This is a simple heuristic system that could be improved with more data
  
  // Sort models by preference score (higher is better)
  const scoredModels = models.map(model => {
    const modelName = model.name.toLowerCase();
    let score = 0;
    
    // Specialized scoring based on task
    switch (task) {
      case 'code-generation':
        if (modelName.includes('code')) score += 10;
        if (modelName.includes('claude-3')) score += 6;
        if (modelName.includes('gpt-4')) score += 8;
        if (modelName.includes('codellama')) score += 10;
        if (modelName.includes('starcoder')) score += 9;
        if (modelName.includes('openchat')) score += 5;
        break;
        
      case 'complex-reasoning':
        if (modelName.includes('claude-3-opus')) score += 10;
        if (modelName.includes('gpt-4-turbo')) score += 9;
        if (modelName.includes('claude-3-sonnet')) score += 8;
        if (modelName.includes('gpt-4')) score += 7;
        if (modelName.includes('claude-3')) score += 5;
        if (modelName.includes('mixtral')) score += 5;
        if (modelName.includes('llama-3-70b')) score += 5;
        break;
        
      case 'creative-writing':
        if (modelName.includes('claude-3')) score += 8;
        if (modelName.includes('gpt-4')) score += 7;
        if (modelName.includes('llama-3')) score += 6;
        if (modelName.includes('mixtral')) score += 5;
        if (modelName.includes('palm')) score += 4;
        break;
        
      case 'summarization':
        if (modelName.includes('haiku')) score += 6; // Faster models often good for summaries
        if (modelName.includes('claude-3')) score += 5;
        if (modelName.includes('gpt-3.5')) score += 5;
        if (modelName.includes('gpt-4')) score += 4;
        if (modelName.includes('llama-3')) score += 3;
        break;
        
      case 'simple-chat':
        if (modelName.includes('gpt-3.5')) score += 7; // Favor faster models for simple chats
        if (modelName.includes('haiku')) score += 7;
        if (modelName.includes('llama-3-8b')) score += 6;
        if (modelName.includes('phi')) score += 6;
        if (modelName.includes('llama-2-7b')) score += 5;
        break;
    }
    
    // General model quality scoring
    if (modelName.includes('opus')) score += 3;
    if (modelName.includes('sonnet')) score += 2;
    if (modelName.includes('claude-3')) score += 2;
    if (modelName.includes('gpt-4')) score += 2;
    if (modelName.includes('70b')) score += 1;
    if (modelName.includes('8b')) score -= 1;
    if (modelName.includes('7b')) score -= 1;
    
    // Compute a context adjustment - sometimes we need models with larger context
    // For longer reasoning tasks especially
    let contextAdjustment = 0;
    if (task === 'complex-reasoning' && model.contextLength) {
      contextAdjustment = Math.min(3, Math.floor(model.contextLength / 8000)); 
    }
    
    return { model, score: score + contextAdjustment };
  });
  
  // Sort by score descending
  scoredModels.sort((a, b) => b.score - a.score);
  
  // Return the highest-scoring model
  return scoredModels.length > 0 ? scoredModels[0].model : models[0];
}

/**
 * Main function to determine the best model for a given prompt
 */
export function selectModelForPrompt(models: Model[], prompt: string): Model | null {
  if (models.length === 0) {
    return null;
  }
  
  const task = analyzePrompt(prompt);
  return findBestModelForTask(models, task);
}