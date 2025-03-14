import { Typography, Box, Divider, Paper } from "@mui/material";

// Componente para mostrar la explicación de los cálculos
const CalculationExplanation = () => {
  return (
    <Paper
      elevation={3}
      sx={{
        mb: 4,
        p: 3,
        borderRadius: 3,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="h5" gutterBottom>
        Cálculo de Caudal y Volumen del Filtro
      </Typography>
      <Typography variant="body1" paragraph>
        El caudal del filtro (en litros/hora) se recomienda que sea, como mínimo,
        10 veces el volumen del acuario en litros. Es decir:
      </Typography>
      <Typography variant="body1" sx={{ pl: 3, fontStyle: 'italic' }}>
        Caudal (l/h) ≥ Volumen del Acuario (l) × 10
      </Typography>

      <Typography variant="body1" paragraph sx={{ mt: 2 }}>
        En cuanto al volumen del material filtrante biológico,
        este se recomienda que sea, como mínimo, el 2.5% del volumen del acuario.
        De forma ideal, debería ser el 5% del volumen del acuario:
      </Typography>
      <Typography variant="body1" sx={{ pl: 3, fontStyle: 'italic' }}>
        Volumen del Material Filtrante (l) ≥ Volumen del Acuario (l) × 0.025 (mínimo)
        <br />
        Volumen del Material Filtrante (l) ≥ Volumen del Acuario (l) × 0.05 (ideal)
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" gutterBottom>
        Volumen del Material Filtrante
      </Typography>
      <Typography variant="body1" paragraph>
        En la base de datos se recoge el volumen total del vaso de los filtros, 
        el volumen real del vaso y en caso de no tener el dato de este último, se hace una estimación.
        El volumen útil o real, que corresponde al material filtrante,
        depende de cada fabricante.
      </Typography>
      
      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" gutterBottom>
        Cálculo de Cargas (Biológica y Mecánica)
      </Typography>
      <Typography variant="body1" paragraph>
        La capacidad de carga biológica y mecánica se calcula como un porcentaje
        del volumen real del vaso del filtro. Si el volumen real está disponible, se utiliza directamente.
        En caso contrario, se estima como el 59% del volumen del vaso en los filtros con cestas y sobre un 85% en los filtros sin cestas.
      </Typography>
    </Paper>
  );
};

export default CalculationExplanation;