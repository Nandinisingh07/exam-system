import React, { createContext, useContext, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("seas-theme") !== "light");
  const toggle = () => setDark(d => {
    localStorage.setItem("seas-theme", d ? "light" : "dark");
    return !d;
  });
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <div data-theme={dark ? "dark" : "light"} style={{ minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
