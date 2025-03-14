import React from 'react';
import { BrainCircuit } from 'lucide-react';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Brand({ size = 'md' }: BrandProps) {
  const fontSize = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];
  
  const subtitleSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <BrainCircuit className="h-6 w-6 text-blue-400" />
        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary rounded-full border-2 border-background animate-pulse"></div>
      </div>
      <div className="flex flex-col">
        <div className={`${fontSize} font-bold tracking-tight`}>
          <span className="text-primary">ml</span>
          <span className="text-blue-400 relative">Face
            <span className="absolute -top-1 -right-1 text-xs text-blue-300">+</span>
          </span>
        </div>
        <span className={`${subtitleSize} text-muted-foreground font-light tracking-wide`}>
          Martin's Last Interface
        </span>
      </div>
    </div>
  );
}
