import '@testing-library/jest-dom/vitest';

// Initialize i18n for tests with Russian locale
import i18n from '../lib/i18n';
void i18n.changeLanguage('ru');
