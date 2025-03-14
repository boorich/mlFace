import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function createStorageHelper<T>(key: string, initialValue: T) {
  return {
    get: (): T => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return initialValue;
      }
    },
    set: (value: T): void => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
      }
    },
    remove: (): void => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
      }
    }
  };
}