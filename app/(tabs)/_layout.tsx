import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import IconSymbol from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        position: 'absolute',
                        height: 80, // Hauteur plus grande pour que l'icône centrale dépasse
                        paddingBottom: 10,
                    },
                    default: {
                        height: 80,
                        paddingBottom: 10,
                    },
                }),
                tabBarLabelStyle: {
                    fontSize: 12, // Taille du texte sous l’icône
                    marginTop: 4, // Espacement entre l’icône et le texte
                },
                tabBarItemStyle: {
                    height: 60, // Ajustement vertical des icônes pour qu'elles soient centrées
                    alignSelf: 'center',
                },
            }}>

            {/* Accueil */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Accueil',
                    tabBarIcon: ({ color }) => <IconSymbol size={25} name="house" color={color} />,
                    tabBarItemStyle: styles.tabItemCentered,
                }}
            />

            {/* Explorer */}
            <Tabs.Screen
                name="defis"
                options={{
                    title: 'Défis',
                    tabBarIcon: ({ color }) => <IconSymbol size={25} name="sports-score" color={color} />,
                    tabBarItemStyle: styles.tabItemCentered,
                }}
            />

            {/* 🏋️ Icône centrale - SANS TEXTE EN DESSOUS */}
            <Tabs.Screen
                name="Programme"
                options={{
                    tabBarLabel: () => null, // Supprime le texte sous l'icône
                    tabBarIcon: ({ color }) => (
                        <View style={styles.centralButton}>
                            <IconSymbol size={30} name="calendar-today" color={color} />
                        </View>
                    ),
                }}
            />

            {/* Chronomètre */}
            <Tabs.Screen
                name="success"
                options={{
                    title: 'Success',
                    tabBarIcon: ({ color }) => <IconSymbol size={25} name="stars" color={color} />,
                    tabBarItemStyle: styles.tabItemCentered,
                }}
            />

            {/* Profil */}
            <Tabs.Screen
                name="Profil"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color }) => <IconSymbol size={25} name="person" color={color} />,
                    tabBarItemStyle: styles.tabItemCentered,
                }}
            />

        </Tabs>
    );
}

const styles = StyleSheet.create({
    centralButton: {
        width: 60,
        height: 60,
        borderRadius: 35,
        backgroundColor: '#fff', // Couleur du bouton central (modifiable)
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5, // Effet d'ombre sur Android
    },
    tabItemCentered: {
        alignSelf: 'center',
        justifyContent: 'center',
        height: 60, // S'assure que les icônes sont bien alignées verticalement
    },
});

