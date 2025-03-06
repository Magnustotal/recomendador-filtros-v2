// app/api/filters/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Filtro } from "@/types/Filtro";

// Comprueba las variables de entorno *fuera* del handler
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in .env.local");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Inicializa el cliente *dentro* del handler
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { id } = params;

    // Consulta a Supabase para obtener el filtro por ID
    const { data, error } = await supabase
      .from("filtros")
      .select("*") // Selecciona todos los campos
      .eq("id", id)
      .single() as { data: Filtro | null; error: any }; // Usamos la interfaz Filtro

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Filtro no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching filter:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener el filtro" },
      { status: 500 },
    );
  }
}