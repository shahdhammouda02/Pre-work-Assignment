// src/services/bookService.ts
import { books } from '@/app/data/books';
import type { Book } from '@/app/types/book';

export function getAllBooks(): Book[] {
  return books.map(book => ({
    ...book,
    genre: Array.isArray(book.genre) ? book.genre.join(', ') : book.genre
  }));
}