/**
 * Input Component
 * Text input with consistent styling and security features
 */

import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  Pressable,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, fontSize, spacing } from '../../theme/spacing';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  showToggle?: boolean; // For password fields
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  containerStyle,
  showToggle = false,
  secureTextEntry,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputFocused,
        error && styles.inputError,
      ]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.brand.primary}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        
        {showToggle && secureTextEntry && (
          <Pressable
            onPress={() => setIsSecure(!isSecure)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {isSecure ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        )}
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  inputFocused: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.background.secondary,
  },
  inputError: {
    borderColor: colors.status.error,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleText: {
    color: colors.brand.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  error: {
    color: colors.status.error,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  hint: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});



