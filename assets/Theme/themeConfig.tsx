import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const colors = {
    dark: {
        background: "#121212",  // Fond sombre
        primary: "#007AFF",  // Bleu moderne
        secondary: "#00C8FF",  // Bleu clair pour les accents
        text: "#F5F5F5",  // Texte clair
        border: "#333",  // Bordures légères
        success: "#00D26A",  // Succès (validation)
        error: "#FF4C4C",  // Erreur
    },
    light: {
        background: "#FFFFFF",  // Fond clair
        primary: "#007AFF",
        secondary: "#005FCC",  // Bleu plus foncé pour les accents
        text: "#121212",  // Texte sombre
        border: "#E0E0E0",
        success: "#28A745",
        error: "#D32F2F",
    },
};

// 🎨 Thèmes personnalisés pour Paper
export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        ...colors.dark,
    },
};

export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        ...colors.light,
    },
};

// 📌 Police globale
export const fonts = {
    regular: "System",
    bold: "System",
    italic: "System",
};
