import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('Plantilla de prueba para App', () => {
  // 1. Arrange (Preparación): se ejecuta antes de cada prueba ("it")
  beforeEach(() => {
    // Aquí podrías inicializar mocks, limpiar estado o preparar datos de prueba
  });

  it('mantiene la estructura base y siempre pasa como referencia', () => {
    // 2. Act (Acción): renderizamos el componente o ejecutamos lo que queremos observar
    const { container } = render(<App />);

    // 3. Assert (Afirmación): verificamos una condición que siempre es verdadera
    expect(container).toBeTruthy();
    expect(true).toBe(true);
  });
});