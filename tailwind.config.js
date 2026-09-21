/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Identidade visual da Gabriel Oficina Mecânica: grafite escuro +
      // vermelho da logo (extraído direto do arquivo da logo) como cor
      // principal, verde-óleo pra status "ok". O laranja que antes era a cor
      // principal virou a cor de alerta/perigo (gauge) — assim o vermelho da
      // marca (botões, links, destaque) nunca se confunde visualmente com
      // "atenção/negativo" (estoque baixo, taxa, prejuízo), que agora é laranja.
      colors: {
        graphite: {
          950: '#0B0D0F',
          900: '#131619',
          800: '#1B1F23',
          700: '#262B31',
          600: '#363D44'
        },
        torque: {
          500: '#E10404',
          400: '#ED4040',
          300: '#F5A3A3'
        },
        oil: {
          500: '#3DA35D',
          400: '#5FBE7C'
        },
        gauge: {
          500: '#FF6A13',
          400: '#FF8A3D'
        }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        card: '10px'
      }
    }
  },
  plugins: []
};
