import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  function handleOpenFinances() {
    Alert.alert(
      'Módulo Financeiro',
      'A tela de finanças será conectada no próximo passo.'
    );
  }

  return (
    <>
      <StatusBar style="dark" />

      <HomeScreen
        onOpenFinances={handleOpenFinances}
      />
    </>
  );
}