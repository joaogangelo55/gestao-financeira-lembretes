import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { brDateToIso, getLocalTodayIso } from '../utils/dates.mjs';

function brDateToLocalDate(value) {
  const iso = brDateToIso(value) ?? getLocalTodayIso();

  const [year, month, day] = iso
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );
}

function localDateToBr(date) {
  const day = String(
    date.getDate()
  ).padStart(2, '0');

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export default function DateInput({
  value,
  onChangeText,
  style,
  ...props
}) {
  const [showPicker, setShowPicker] =
    useState(false);

  function handleChange(
    event,
    selectedDate
  ) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (
      event?.type === 'dismissed' ||
      !selectedDate
    ) {
      return;
    }

    onChangeText(
      localDateToBr(selectedDate)
    );
  }

  return (
    <View>
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel="Selecionar data"
        onPress={() =>
          setShowPicker(true)
        }
        style={[style, styles.field]}
      >
        <Text
          style={[
            styles.value,
            !value && styles.placeholder,
          ]}
        >
          {value || 'DD/MM/AAAA'}
        </Text>

        <Text style={styles.icon}>
          📅
        </Text>
      </Pressable>

      {showPicker && (
        <View style={styles.pickerArea}>
          <DateTimePicker
            value={brDateToLocalDate(
              value
            )}
            mode="date"
            display={
              Platform.OS === 'ios'
                ? 'inline'
                : 'default'
            }
            locale="pt-BR"
            onChange={handleChange}
          />

          {Platform.OS === 'ios' && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setShowPicker(false)
              }
              style={styles.doneButton}
            >
              <Text
                style={styles.doneText}
              >
                Concluir
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  value: {
    flex: 1,
    color: '#0E0F0C',
    fontSize: 16,
  },

  placeholder: {
    color: '#7A8277',
  },

  icon: {
    marginLeft: 12,
    fontSize: 20,
  },

  pickerArea: {
    marginTop: 8,
  },

  doneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  doneText: {
    color: '#356D17',
    fontWeight: '800',
  },
});