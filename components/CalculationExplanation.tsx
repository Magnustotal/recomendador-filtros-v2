// components/CalculationExplanation.tsx

const CalculationExplanation: React.FC = () => {
  return (
    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-md mb-4">
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
        Explicación de los Cálculos 🧮
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-2">
        La clasificación de los filtros se basa en dos criterios principales:
        el caudal y el volumen del vaso del filtro.
      </p>
      <h4 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-200">
        Caudal 🌊
      </h4>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        El caudal, medido en litros por hora (l/h), indica la cantidad de agua
        que el filtro puede procesar en una hora. Para un filtrado efectivo,
        recomendamos un caudal que sea al menos 10 veces el volumen de tu
        acuario. Por ejemplo, para un acuario de 100 litros, el filtro
        idealmente debería tener un caudal de 1000 l/h o más.
      </p>
      <h4 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-200">
        Volumen del Vaso del Filtro 🛢️
      </h4>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        El volumen del vaso del filtro se refiere a la cantidad de material
        filtrante que puede contener. Se recomienda que al menos el 90% de este
        volumen esté ocupado por material filtrante biológico, y el resto por
        material filtrante mecánico. Para que un filtro sea considerado
        &quot;Recomendado&quot;, este volumen (al 90% de su capacidad) debe
        ser al menos el 5% del volumen del acuario. Para ser considerado
        &quot;Mínimo&quot;, debe ser al menos el 2.5% del volumen del acuario.
      </p>
      <h4 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-200">
        Clasificación de Filtros 🚦
      </h4>
      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-4">
        <li>
          <strong className="text-green-600 dark:text-green-400">
            Recomendado:
          </strong>{" "}
          Cumple con ambos criterios (caudal y volumen del vaso).
        </li>
        <li>
          <strong className="text-yellow-600 dark:text-yellow-400">
            Mínimo:
          </strong>{" "}
          Cumple con el requisito de caudal, pero el volumen del vaso es menor
          que el recomendado, aunque suficiente para una filtración básica.
        </li>
        <li>
          <strong className="text-red-600 dark:text-red-400">
            Insuficiente:
          </strong>{" "}
          No cumple con el requisito mínimo de caudal.
        </li>
      </ul>
      <p className="text-gray-700 dark:text-gray-300">
        <strong className="text-blue-600 dark:text-blue-400">
          Combinaciones de filtros:
        </strong>{" "}
        Si un filtro individual no cumple con los requisitos, se mostrarán
        combinaciones de dos filtros *del mismo modelo*.
      </p>
    </div>
  );
};

export default CalculationExplanation;