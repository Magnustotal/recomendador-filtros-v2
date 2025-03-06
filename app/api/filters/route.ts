// app/api/filters/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Filtro } from "@/types/Filtro"; // Importa la interfaz Filtro

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  try {
    const { data, error } = await supabase
      .from("filtros")
      .select("*") as { data: Filtro[] | null; error: any }; // Usamos la interfaz Filtro

    if (error) {
      // Devuelve un error 500 con el mensaje del error de Supabase
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Devuelve los datos como JSON con un código de estado 200
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    // Captura cualquier otro error (por ejemplo, un error de red)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}