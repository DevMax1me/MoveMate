import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';

interface IconSymbolProps {
  name: string;
  size?: number;
  color?: string;
  type?: 'material' | 'fontawesome' | 'ionicon';
}

const IconSymbol: React.FC<IconSymbolProps> = ({ name, size = 24, color = 'black', type = 'material' }) => {
  if (type === 'fontawesome') {
    return <FontAwesome name={name as any} size={size} color={color} />;
  }
  if (type === 'ionicon') {
    return <Ionicons name={name as any} size={size} color={color} />;
  }
  return <MaterialIcons name={name as any} size={size} color={color} />;
};

export default IconSymbol;
