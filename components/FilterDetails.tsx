export default function FilterDetails({ filter, onClose }: FilterDetailsProps) {
    if (!filter) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-8 w-full max-w-2xl shadow-lg">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-semibold text-white">
                        {filter.marca} {filter.modelo}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full p-2"
                        aria-label="Cerrar"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-6 h-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Caudal:</span> {filter.caudal} l/h
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Volumen del vaso:</span>{" "}
                            {filter.volumen_vaso_filtro} l
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Volumen del prefiltro:</span>{" "}
                            {filter.volumen_prefiltro !== null ? `${filter.volumen_prefiltro} l` : 'N/A'}
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Volumen real del vaso:</span>{" "}
                            {filter.volumen_vaso_real !== null ? `${filter.volumen_vaso_real} l` : 'N/A'}
                        </p>
                         <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Número de cestas:</span> {filter.cestas !== null ? filter.cestas : 'N/A'}
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Consumo:</span> {filter.consumo !== null ? `${filter.consumo} W` : 'N/A'}
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">ASIN:</span>{" "}
                            {filter.asin ? (
                                <a
                                    href={`https://www.amazon.es/dp/${filter.asin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-400"
                                >
                                    {filter.asin}
                                </a>
                            ) : (
                                'N/A'
                            )}
                        </p>
                    </div>
                  </div>
            </div>
        </div>
    );
}