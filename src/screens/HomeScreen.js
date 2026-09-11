import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen({ onOpenFinances }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meu Financeiro</Text>

        <Text style={styles.subtitle}>
          Organize suas finanças e compromissos em um único lugar.
        </Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.card}
          onPress={onOpenFinances}
        >
          <Text style={styles.cardIcon}>💰</Text>

          <Text style={styles.cardTitle}>
            Finanças
          </Text>

          <Text style={styles.cardDescription}>
            Cadastre receitas, despesas e acompanhe suas contas.
          </Text>
        </TouchableOpacity>

        <View style={[styles.card, styles.disabledCard]}>
          <Text style={styles.cardIcon}>🔔</Text>

          <Text style={styles.cardTitle}>
            Lembretes
          </Text>

          <Text style={styles.cardDescription}>
            Esta funcionalidade será desenvolvida em uma próxima etapa.
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Aplicativo de Gestão Financeira e Lembretes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 30,
  },

  header: {
    marginBottom: 32,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#64748b',
  },

  content: {
    gap: 16,
  },

  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  disabledCard: {
    opacity: 0.5,
  },

  cardIcon: {
    fontSize: 32,
  },

  cardTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  cardDescription: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#64748b',
  },

  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
  },
});