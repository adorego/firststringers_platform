# First Stringers — Tokens visuales

Paleta única para Jerry y Billy. Aprobada por Abel el 2026-09-02; el source of truth es el prototipo *Athlete Dossier Experience*, no las pantallas actuales de ninguno de los dos lados.

## Los tokens

Definidos en `src/app/globals.css`, dentro de `@theme inline`. Se usan como clases de Tailwind.

| Token | Valor | Rol | Clases |
|---|---|---|---|
| `fs-bg` | `#FAF8F5` | Fondo principal de pantalla | `bg-fs-bg` |
| `fs-surface` | `#F3F0EC` | Tarjetas, paneles, burbujas del agente | `bg-fs-surface` |
| `fs-surface-alt` | `#EBE8E4` | Superficie secundaria, hover | `bg-fs-surface-alt` |
| `fs-text` | `#27251E` | Texto principal, superficies oscuras | `text-fs-text` `bg-fs-text` |
| `fs-text-muted` | `#6B6962` | Texto secundario, timestamps, placeholders | `text-fs-text-muted` |
| `fs-border` | `rgba(39,37,30,.08)` | Bordes y divisores | `border-fs-border` |
| `fs-accent` | `#7B91A8` | Acento puntual, azul-gris apagado | `text-fs-accent` |
| `fs-accent-muted` | `#A8B8C6` | Acento suave | `bg-fs-accent-muted` |

**Regla:** no escribir hex nuevos. Si un color no está acá, pedir que se defina el token antes de usarlo.

## Mapeo desde Billy

Equivalencias para migrar el lado del recruiter. La columna izquierda son los valores que hoy están en `components/recruiter/` y `app/(recruiter)/`.

| Billy hoy | Usos | Token |
|---|---|---|
| `#1A1A1A` | 74 | `fs-text` |
| `#ADA8A5` | 69 | `fs-text-muted` |
| `#EDEAE5` | 25 | `fs-surface` |
| `#3B6FE8` | 25 | **eliminar** — ver abajo |
| `#4B4745` | 21 | `fs-text-muted` |
| `#6B6561` | 18 | `fs-text-muted` |
| `#E8E3DD` | 15 | `fs-surface-alt` |
| `#E4DDD7` | 14 | `fs-surface-alt` |
| `#F5F5F0` | 11 | `fs-bg` |
| `#F0EDE9` | 9 | `fs-surface` |
| `#C4BDBA` | 7 | `fs-border` |
| `#FAFAF9` | 6 | `fs-bg` |

### Sobre el azul

`#3B6FE8` sale. Es el azul brillante que Abel quiere fuera de la UI.

Según el caso:

- **Botones y acciones principales** → `bg-fs-text` con texto claro. La acción se jerarquiza por peso, no por color.
- **Links y elementos interactivos secundarios** → `text-fs-accent`.
- **Badges y estados** → `bg-fs-surface-alt` con `text-fs-text`, salvo que el estado tenga significado semántico propio.

`fs-accent` (`#7B91A8`) sí se conserva, pero como acento puntual. No debe ser predominante.

## Dónde está cada cosa

```
src/app/globals.css              ← única definición de tokens
src/app/(athlete)/               ← Jerry. Ya migrado
src/components/ui/BottomNav.tsx  ← chrome de Jerry. Ya migrado
src/app/(recruiter)/             ← Billy. Pendiente
src/components/recruiter/        ← Billy. Pendiente
src/components/ui/Sidebar.tsx    ← chrome de Billy. Pendiente
```

`components/ui/` (Button, Card, Badge, Avatar, ProgressBar, ReadinessBadge) está compartido y todavía usa la paleta legada `fs-black` / `fs-teal` / `fs-dark-card`. Coordinar antes de tocarlo.

`components/ui/Navbar.tsx` no lo importa nadie.

## Qué quedó fuera de este pass

- **El Dossier**, por decisión de producto: primero se cierra qué información muestra.
- **Los azul-grises del dossier del atleta** — `#6F7F95`, `#4A5F79`, `#DDE5EF` — son variantes del accent con más contraste. Si se confirman, merecen tokens propios (`fs-accent-strong`, `fs-accent-tint`).
- **`#C0C0BC`**, borde de foco en inputs. Falta decidir si el foco usa `fs-accent` o un token propio.
- **La paleta legada** `fs-black`, `fs-teal`, `fs-dark-card` sigue viva en `components/ui`. Se reemplaza cuando se unifiquen esos componentes.

## Tipografía

Inter, vía `next/font/google`, expuesta como `--font-inter`. El prototipo pide Söhne Buch (Klim, licencia comercial); queda para el design system definitivo.
