import React, { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext({ theme: 'dark', dark: true, toggle: () => {} });
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('seas-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('seas-theme', theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return (
    <ThemeContext.Provider value={{ theme, dark: theme === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
