import { createContext, useContext } from 'react';
import { STRINGS } from './strings';

export const LANGS = ['en', 'de'];

// Each page's HTML entry sets <html lang>, which picks the language.
export const pageLang = () => (document.documentElement.lang === 'de' ? 'de' : 'en');

export const LangContext = createContext('en');
export const useLang = () => useContext(LangContext);
export const useT = () => STRINGS[useLang()];

// Internal page path in the given language: '/projects/' -> '/de/projects/'.
export const localePath = (lang, path) => (lang === 'de' ? `/de${path}` : path);

// Resolve a value that is either plain or a per-language { en, de } object.
export const pick = (value, lang) =>
  value && typeof value === 'object' && !Array.isArray(value) && 'en' in value ? (value[lang] ?? value.en) : value;

// Remember an explicit language choice so the auto-redirect in the English
// pages' <head> respects it.
export const rememberLang = lang => {
  try {
    localStorage.setItem('lang', lang);
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
};

// Resolve every per-language field of an object (e.g. a FEATURED project).
export const localize = (obj, lang) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, pick(v, lang)]));
