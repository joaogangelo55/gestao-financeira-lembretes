import { TextInput } from 'react-native';
import { formatDateInput } from '../utils/dates.mjs';

export default function DateInput({ value, onChangeText, style, ...props }) {
  return <TextInput {...props} style={style} value={value} onChangeText={(next) => onChangeText(formatDateInput(next))} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />;
}
