import React, { createContext, useState, useContext, ReactNode } from 'react';
import { darkTheme, lightTheme } from '@/assets/Theme/themeConfig';

interface ThemeContextType {
    theme: typeof darkTheme;
    toggleTheme: () => void;
    isDarkTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    const theme = isDarkTheme ? darkTheme : lightTheme;

    const toggleTheme = () => setIsDarkTheme((prev) => !prev);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
