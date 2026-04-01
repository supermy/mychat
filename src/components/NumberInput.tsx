import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  placeholder?: string;
  theme?: any;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  placeholder,
  theme = colors.light,
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const handleDecrease = () => {
    const newValue = value - step;
    if (min !== undefined && newValue < min) return;
    onChange(Number(newValue.toFixed(precision)));
  };

  const handleIncrease = () => {
    const newValue = value + step;
    if (max !== undefined && newValue > max) return;
    onChange(Number(newValue.toFixed(precision)));
  };

  const handleChangeText = (text: string) => {
    setInputValue(text);
    
    if (text === '' || text === '-') {
      return;
    }
    
    const numValue = parseFloat(text);
    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) return;
      if (max !== undefined && numValue > max) return;
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (inputValue === '' || inputValue === '-') {
      onChange(min ?? 0);
    }
    setInputValue('');
  };

  const handleFocus = () => {
    setIsEditing(true);
    setInputValue(precision > 0 ? value.toFixed(precision) : String(value));
  };

  const displayValue = isEditing ? inputValue : (precision > 0 ? value.toFixed(precision) : String(value));

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={handleDecrease}
      >
        <Text style={[styles.buttonText, { color: theme.text }]}>−</Text>
      </TouchableOpacity>
      
      <TextInput
        style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="numeric"
        placeholder={placeholder}
      />
      
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={handleIncrease}
      >
        <Text style={[styles.buttonText, { color: theme.text }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    padding: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 70,
    textAlign: 'center',
  },
});
