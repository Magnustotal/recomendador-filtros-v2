// app/api/filters/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa el cliente de Supabase (asegúrate de que las variables de entorno estén configuradas)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in .env.local');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Consulta a Supabase para obtener el filtro por ID
    const { data, error } = await supabase
      .from('filtros')
      .select('*') // Selecciona todos los campos
      .eq('id', id)
      .single(); // Espera un único resultado

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Filtro no encontrado' }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("Error fetching filter:", error);
    return NextResponse.json({ error: error.message || 'Error al obtener el filtro' }, { status: 500 });
  }
}