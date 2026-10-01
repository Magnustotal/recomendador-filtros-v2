import type { Metadata } from "next";
import NextLink from "next/link";
import { Box, Link, Stack, Typography } from "@mui/material";

export const metadata: Metadata = {
  title: "Privacidad | Recomendador de Filtros",
  description: "Qué datos trata (y cuáles no) el Recomendador de Filtros para Acuarios.",
};

export default function PrivacidadPage() {
  return (
    <Box component="article" sx={{ maxWidth: 720, mx: "auto" }}>
      <Stack spacing={3}>
        <Typography variant="h3" component="h1">
          Privacidad
        </Typography>
        <Typography color="text.secondary">Última actualización: octubre de 2026.</Typography>

        <Section title="Resumen">
          El Recomendador de Filtros no pide registro, no tiene cuentas de usuario y no recoge datos
          personales. Los cálculos (litros, medidas, filtros recomendados) se hacen en tu propio
          dispositivo y no se envían a ningún servidor.
        </Section>

        <Section title="Qué se guarda en tu dispositivo">
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <li>
              Tu preferencia de tema (claro, oscuro o el del sistema), en el almacenamiento local del navegador.
            </li>
            <li>
              Una copia de la aplicación (página, estilos, scripts e iconos) para que funcione sin conexión
              y se instale como app. No contiene datos tuyos.
            </li>
          </Box>
          Puedes borrar ambas cosas en cualquier momento desde los ajustes de tu navegador.
        </Section>

        <Section title="Cookies y analítica">
          La aplicación no usa cookies propias ni herramientas de analítica o publicidad.
        </Section>

        <Section title="Portapapeles">
          El botón «Pegar» lee el portapapeles solo cuando lo pulsas y tu navegador lo permite, únicamente
          para extraer tres medidas. El contenido no se guarda ni se envía.
        </Section>

        <Section title="Enlaces externos">
          Los enlaces a webs de fabricantes, tiendas (por ejemplo Amazon) llevan a sitios de
          terceros con sus propias políticas de privacidad.
        </Section>

        <Section title="Alojamiento">
          Como ocurre en cualquier sitio web, el proveedor de alojamiento puede registrar datos técnicos de
          la conexión (como la dirección IP) por motivos de seguridad y funcionamiento.
        </Section>

        <Link component={NextLink} href="/" underline="hover">
          ← Volver al recomendador
        </Link>
      </Stack>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography component="div" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}
