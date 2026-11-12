import {
  brDateToIso,
  isoToBrDate,
} from '../utils/dates.mjs';

export default function DateInput({
  value,
  onChangeText,
  style,
  ...props
}) {
  const isoValue =
    brDateToIso(value) ?? '';

  return (
    <input
      {...props}
      aria-label="Selecionar data"
      type="date"
      value={isoValue}
      onChange={(event) =>
        onChangeText(
          isoToBrDate(
            event.target.value
          )
        )
      }
      style={{
        boxSizing: 'border-box',

        width: '100%',

        minHeight:
          style?.minHeight ??
          48,

        border: `${
          style?.borderWidth ??
          1
        }px solid ${
          style?.borderColor ??
          '#D7DDD2'
        }`,

        borderRadius:
          style?.borderRadius ??
          13,

        backgroundColor:
          style?.backgroundColor ??
          '#FFFFFF',

        padding: `0 ${
          style?.paddingHorizontal ??
          13
        }px`,

        color:
          style?.color ??
          '#0E0F0C',

        fontSize:
          style?.fontSize ??
          16,

        fontFamily: 'inherit',
      }}
    />
  );
}