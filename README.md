# 🐠 Recomendador de Filtros para Acuarios

Calcula de manera rápida y visual qué filtro externo necesitas para tu acuario.  
💧 100% gratuito, sin registro, basado en criterios técnicos y experiencia real de la comunidad acuariófila.

---

## 🚀 Características principales

- **Cálculo automático**: Elige el filtro ideal según los litros o medidas de tu acuario.
- **Catálogo actualizado**: Selección de modelos de las principales marcas (Eheim, JBL, Oase, Fluval...).
- **Modo claro/oscuro**: Tema Material UI totalmente adaptado a tu sistema.
- **Sin registro, sin datos personales**: Consulta abierta y anónima.
- **Interfaz moderna y responsive**: Diseño profesional, preparado para móvil, tablet y escritorio.
- **Tips y consejos**: Basados en experiencia real y buenas prácticas de mantenimiento.
- **Open Source**: ¡Colabora, propone mejoras o crea tu propio fork!

---

## 🖥️ Demo en vivo

- **[Ver demo en Vercel](https://turecomendador.vercel.app/)** _(cambia la URL si la tuya es otra)_

---

## 🛠️ Tecnologías utilizadas

- [Next.js](https://nextjs.org/) (App Router)
- [Material UI (MUI)](https://mui.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Framer Motion](https://www.framer.com/motion/) (animaciones)
- [Google Fonts](https://fonts.google.com/) (Montserrat, Roboto)
- ¡Sin dependencias innecesarias!

---

## ⚡ Instalación y desarrollo local

# 1. Clona el repositorio desde GitHub (reemplaza la URL si tu repo es otro)
git clone https://github.com/Magnustotal/recomendador-filtros-v2.git

# 2. Entra en la carpeta del proyecto
cd recomendador-filtros-v2

# 3. Instala las dependencias del proyecto
npm install

# 4. Inicia el entorno de desarrollo local
npm run dev

# 5. Abre la aplicación en tu navegador en la siguiente URL:
# http://localhost:3000

# ¡Listo! Ahora puedes empezar a probar y modificar la aplicación en local.


## 🚢 Despliegue

- Puedes desplegar fácilmente en [Vercel](https://vercel.com/) (recomendado), Netlify o cualquier proveedor compatible con Next.js.
- Haz push a tu rama principal y conecta el repo en Vercel, ¡sin configuración adicional!

---

## 🗂️ Estructura de carpetas

app
/components
/data
/theme
layout.tsx
page.tsx
/lib
/types
/public
README.md
package.json
...


- **app/components/**: Componentes visuales y funcionales.
- **app/data/**: Filtros y catálogos.
- **app/theme/**: Provider del tema Material.
- **lib/**: Utilidades y lógica de negocio (cálculo de caudal, etc).
- **types/**: Definición de tipos TypeScript.

---

## 🎨 Personalización

- **Colores, sombras y fuentes**: Edita `/app/theme/ThemeProvider.tsx`.
- **Catálogo de filtros**: Modifica `/app/data/filtros.ts`.
- **Lógica de recomendación**: Edita `/lib/filters.ts`.
- **Añade tu logo**: Sustituye el favicon y la imagen en `/public/`.

---

## 🤝 Contribuir

¿Quieres mejorar el catálogo, la lógica de recomendación o el diseño?
- Abre un **issue** o un **pull request**.
- Respeta el estilo de código (TypeScript, ESLint, formato Prettier).
- Todo el feedback de la comunidad es bienvenido.

---

## 📃 Licencia

MIT © 2024 [Magnustotal](https://github.com/Magnustotal)  
Sin ánimo de lucro — para uso personal y de la comunidad.

---

## ❤️ Créditos y agradecimientos

Proyecto inspirado en foros de acuariofilia, aportes de usuarios reales y experiencia personal.  
Gracias a quienes comparten conocimiento y ayudan a mejorar el hobby.

---

> ¿Dudas, sugerencias o quieres añadir tu modelo de filtro?  
> ¡Abre un issue o contacta en GitHub!
