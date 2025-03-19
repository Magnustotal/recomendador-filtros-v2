import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Filtro } from "@/types/Filtro";

// Verificar que las variables de entorno estén definidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL and Anon Key must be defined in environment variables."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(_req: NextRequest) {
  try {
    // Obtener todos los filtros desde Supabase
    const { data, error } = await supabase
      .from("filtros")
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Devolver los datos como un array de Filtro
    return NextResponse.json((data as Filtro[]) || [], { status: 200 });
  } catch (error) {
    console.error("Error en la ruta /api/filters:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}