export default function DimensionsInput({ dimensions, onChange }: DimensionsInputProps) {
    return (
        <div className="max-w-2xl mx-auto p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg">
            <h3 className="text-lg font-medium text-white mb-4">
                Dimensiones del Acuario
            </h3>
            <div className="grid grid-cols-3 gap-6">
                {[
                    { key: 'length', label: 'Largo', icon: '↔️' },
                    { key: 'width', label: 'Ancho', icon: '↔️' },
                    { key: 'height', label: 'Alto', icon: '↕️' }
                ].map(({ key, label, icon }) => (
                    <div key={key} className="relative">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {label} {icon}
                        </label>
                        <input
                            type="number"
                            value={dimensions[key]}
                            onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (!isNaN(value) && value >= 0) {
                                    onChange(key, value);
                                }
                            }}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder={`${label} (cm)`}
                            min="0"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}