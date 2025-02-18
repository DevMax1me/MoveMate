import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TextInput } from 'react-native';
import { Provider as PaperProvider, Button, Modal, Portal, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '@/components/ThemedContext';

const HomeScreen = () => {
    const [calories, setCalories] = useState<string | null>(null);
    const [sessions, setSessions] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingField, setEditingField] = useState<'calories' | 'sessions' | null>(null);
    const [inputValue, setInputValue] = useState('');

    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        // Charger les valeurs sauvegardées
        const loadData = async () => {
            const savedCalories = await AsyncStorage.getItem('calories');
            const savedSessions = await AsyncStorage.getItem('sessions');
            setCalories(savedCalories);
            setSessions(savedSessions);
        };
        loadData();
    }, []);

    const openModal = (field: 'calories' | 'sessions') => {
        setEditingField(field);
        setInputValue(field === 'calories' ? calories ?? '' : sessions ?? '');
        setModalVisible(true);
    };

    const saveChanges = async () => {
        if (editingField === 'calories') {
            setCalories(inputValue);
            await AsyncStorage.setItem('calories', inputValue);
        } else {
            setSessions(inputValue);
            await AsyncStorage.setItem('sessions', inputValue);
        }
        setModalVisible(false);
    };

    // @ts-ignore
    return (
        <PaperProvider theme={theme}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Séance du jour !</Text>
                    <IconButton icon="cog" onPress={toggleTheme}/>
                </View>

                <View style={styles.infoContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Calories par jour :</Text>
                    <View style={styles.valueContainer}>
                        <Text style={[styles.value, { color: calories ? theme.colors.primary : theme.colors.text }]}>
                            {calories ?? 'Inscrivez le nombre de calories'}
                        </Text>
                        <IconButton icon="pencil" onPress={() => openModal('calories')}/>
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Séances par semaine :</Text>
                    <View style={styles.valueContainer}>
                        <Text style={[styles.value, { color: sessions ? theme.colors.primary : theme.colors.text }]}>
                            {sessions ?? 'Inscrivez le nombre de séances'}
                        </Text>
                        <IconButton icon="pencil" onPress={() => openModal('sessions')}/>
                    </View>
                </View>

                <Portal>
                    <Modal
                        visible={modalVisible}
                        onDismiss={() => setModalVisible(false)}
                        contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.background }]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            Modifier {editingField === 'calories' ? 'les calories' : 'les séances'}
                        </Text>
                        <TextInput
                            value={inputValue}
                            onChangeText={setInputValue}
                            keyboardType="numeric"
                            placeholder={editingField === 'calories' ? 'Entrez vos calories' : 'Entrez vos séances'}
                            placeholderTextColor={theme.colors.border}
                            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.primary }]}
                        />
                        <Button onPress={saveChanges} mode="contained" style={styles.saveButton}>
                            Valider
                        </Button>
                        <Button onPress={() => setModalVisible(false)} mode="outlined" style={styles.cancelButton}>
                            Fermer
                        </Button>
                    </Modal>
                </Portal>
            </SafeAreaView>
        </PaperProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    infoContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 18,
        marginBottom: 4,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 12,
        borderRadius: 8,
    },
    value: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalContainer: {
        padding: 20,
        borderRadius: 10,
        margin: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
    },
    saveButton: {
        marginTop: 10,
        backgroundColor: '#007AFF', // Bleu électrique
    },
    cancelButton: {
        marginTop: 5,
        borderColor: '#FF4C4C', // Rouge
    },
});

const App = () => (
    <ThemeProvider>
        <HomeScreen />
    </ThemeProvider>
);

export default App;
