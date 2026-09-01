# CLAUDE.md — First Stringers Web (Jerry + Billy)

Reglas para integrar diseños de Figma en `apps/web`. Estado verificado contra el código el 2026-09-02.

## Lo primero que hay que saber

**Existe una capa de tokens y está mayormente sin usar.** Antes de traducir cualquier diseño de Figma, entender esto o vas a agrandar el problema:

| | Cantidad |
|---|---|
| Usos de tokens `fs-*` | 141 |
| Usos de hex arbitrario (`bg-[#EDEDEA]`) | **723** |
| Valores hex distintos en el código | **70** |

Hay **dos sistemas visuales conviviendo**:

1. **El declarado** — en `src/app/globals.css`, tokens `--color-fs-*`: negro, teal `#00D4AA`, `dark-card #111827`. Es el design system original.
2. **El de facto** — neutrales cálidos escritos a mano en cada pantalla: `#F5F5F0`, `#EDEDEA`, `#2D2D2D`. No existe como token en ningún lado.

Las pantallas del atleta y de recruiter corren sobre el sistema 2. Los componentes de `components/ui` corren sobre el 1. Incluso `body` en `globals.css` pinta fondo negro (`--color-fs-black`) y el layout del atleta lo pisa con `bg-[#F5F5F0]`.

**Regla:** al implementar un diseño de Figma, NO agregues hex nuevos. Si el color que devuelve Figma no existe como token, decilo y pedí que se defina el token antes de escribir la pantalla.

## 1. Tokens

Tailwind v4, configuración CSS-first. **No hay `tailwind.config.js`** — todo vive en `src/app/globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-mono);

  --color-fs-black: #000000;
  --color-fs-dark-card: #111827;
  --color-fs-teal: #00D4AA;
  /* … semánticos: fs-green, fs-amber, fs-red, fs-blue, fs-purple */

  --radius-sm: 4px;   --radius-md: 8px;   --radius-lg: 12px;
  --radius-xl: 16px;  --radius-2xl: 24px; --radius-full: 9999px;
}
```

Se usan como clases Tailwind: `bg-fs-black`, `text-fs-muted`, `border-fs-border-gray`, `rounded-lg`.

**Ausentes de los tokens** (y presentes en 723 lugares del código) los neutrales cálidos que hoy definen el producto:

| Rol real | Valor | Token |
|---|---|---|
| Background principal | `#F5F5F0` | no existe |
| Superficie secundaria | `#EDEDEA` | no existe |
| Superficie hover | `#E8E8E4` | no existe |
| Texto principal | `#2D2D2D` | no existe |
| Texto secundario | `#A0A0A0` | no existe |
| Bordes | `#E0E0DC` | no existe |
| Burbuja del atleta | `#3D3D3D` | no existe |

Además hay **cuatro casi-negros** compitiendo: `#2D2D2D` (chat, profile), `#27251E` (solo dossier), `#1A1A1A` (Sidebar, y principal de Billy), `#111827` (Navbar, Button, Badge). Y el azul `#3B6FE8` en Billy, que producto quiere eliminar.

No hay pipeline de transformación de tokens (Style Dictionary o similar). Lo que hay es el `@theme` de Tailwind directo.

## 2. Componentes

`src/components/`:

```
ui/          Button, Card, Badge, Avatar, ProgressBar,
             Navbar, Sidebar, BottomNav, ReadinessBadge
recruiter/   DossierPanel, PipelineDrawer, IntroductionsDrawer
providers/
```

**Ojo con `ui/index.ts`:** solo exporta 5 de los 10 componentes. Navbar, Sidebar, BottomNav y ReadinessBadge se importan por ruta directa. Al agregar uno nuevo, exportalo ahí.

Patrón: función con `forwardRef`, variantes como `Record<Variant, string>` de clases Tailwind, sin `cva` ni `clsx` — concatenación de strings.

```tsx
type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantStyles: Record<Variant, string> = {
  primary: "bg-fs-black text-fs-white hover:bg-[#1a1a1a]",
  secondary: "border border-fs-border-gray bg-white text-[#111827] hover:bg-fs-light-gray",
};
```

Ese fragmento real de `Button.tsx` muestra el problema en miniatura: token, hex crudo y un hex que **duplica un token existente** (`#111827` es `fs-dark-card`), los tres en dos líneas.

**No hay Storybook** ni documentación de componentes. La referencia es el código.

## 3. Framework y build

- **Next.js 16.1.6**, App Router, React 19.2.3
- **Tailwind CSS v4** vía `@tailwindcss/postcss` — sin archivo de config JS
- **TypeScript** strict, alias `@/*` → `src/*`
- Estado: **Zustand**. Datos: **@tanstack/react-query** + axios
- Auth: **next-auth**. Realtime: **socket.io-client**
- pnpm, monorepo con Turborepo

Verificaciones: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.

> `AGENTS.md` del landing advierte que Next.js 16 trae cambios de API respecto de versiones anteriores. Consultar `node_modules/next/dist/docs/` antes de asumir comportamiento.

## 4. Assets

`public/` — hoy contiene **solo los SVG por defecto de Next.js** (`next.svg`, `vercel.svg`, `window.svg`, `file.svg`, `globe.svg`) más `images/`. Son restos del scaffold, no assets del producto.

Al bajar assets de Figma: guardarlos en `public/images/`, referenciarlos con `next/image` y **nunca** dejar la URL temporal de Figma en el código — expira en ~7 días.

No hay CDN configurado ni pipeline de optimización más allá de lo que hace `next/image`.

## 5. Iconos

**lucide-react**, importados nombrados en cada componente que los usa (20 archivos):

```tsx
import { ArrowLeft, Check, LogOut } from "lucide-react";
<ArrowLeft size={20} />
```

Tamaño por prop `size`, nunca por clase. No hay wrapper ni registro central de iconos, y no hay SVG propios versionados.

**Al traer un icono de Figma:** si existe un equivalente en lucide con el mismo glifo, usar lucide. Si no, exportar el SVG de Figma a `public/images/`. Nunca dibujar el `<path>` a mano.

## 6. Estilos

Tailwind utility-first en JSX. Sin CSS Modules, sin styled-components. El único CSS es `globals.css`.

Responsive con los breakpoints de Tailwind: mobile-first, `sm:` `md:` `lg:`. Patrón habitual `flex-col` → `lg:flex-row`.

No hay dark mode implementado en `apps/web` pese a que el `CLAUDE.md` raíz lo menciona: `body` fija fondo negro y cada layout lo pisa.

## 7. Estructura

```
src/
  app/
    (athlete)/    chat, dossier, conversations, updates, profile, pipeline
    (recruiter)/  billy, billy/[id], search, matches
    (auth)/       login, register
    welcome/      welcome, returning, verify
    globals.css   ← única fuente de tokens
    layout.tsx    ← fuentes: Inter + JetBrains Mono (next/font/google)
  components/     ui, recruiter, providers
  hooks/  lib/  store/  types/
```

Route groups por audiencia. Cada grupo tiene su `layout.tsx` con su propio fondo — de ahí que el fondo global sea irrelevante.

Fuentes expuestas como variables CSS: `--font-inter` (sans) y `--font-mono` (JetBrains Mono).

## Reglas al implementar un diseño de Figma

1. **Correr `get_design_context` sobre el nodo.** No sustituirlo por screenshot.
2. **Mapear colores a tokens `fs-*` cuando exista equivalencia.** Si el diseño trae un neutral cálido, hoy no hay token: reportarlo en vez de agregar el hex número 71.
3. **Reusar `components/ui` antes de escribir uno nuevo.** Verificar si el componente ya existe aunque el nombre en Figma no coincida.
4. **Radios: usar la escala** `rounded-lg` / `rounded-2xl`, no `rounded-[14px]`.
5. **Iconos por lucide o SVG exportado.** Nunca dibujados a mano.
6. **No cambiar estructura ni navegación** salvo pedido explícito. La dirección de producto vigente es alineación visual, no rediseño.

## Deuda conocida

- 723 hex hardcodeados, 70 valores distintos, para un producto cuya paleta real son ~8 colores.
- Los tokens declarados describen un sistema (negro/teal) que las pantallas ya no usan.
- `#111827` existe como token `fs-dark-card` y aun así se escribe a mano.
- `ui/index.ts` exporta la mitad de los componentes.
- `public/` conserva los assets del scaffold de Next.js.
