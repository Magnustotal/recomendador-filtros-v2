export default function ModeSelector({ dimensionsMode, onModeSelect }) {
  return (
    <div className="max-w-4xl mx-auto mb-12">
      <div className="glass-card p-8 transform hover:scale-[1.02] transition-all duration-300">
        <h2 className="text-2xl font-bold text-center text-white mb-8">
          ¿Cómo quieres calcular el volumen?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onModeSelect(true)}
            className={`relative group p-8 rounded-xl transition-all duration-300 
              ${dimensionsMode === true 
                ? 'bg-blue-500/30 border-2 border-blue-400' 
                : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
          >
            <div className="text-center space-y-4">
              <span className="text-5xl block group-hover:animate-bounce">📏</span>
              <span className="text-xl font-medium text-white block">
                Dimensiones
              </span>
              <p className="text-blue-100/80 text-sm">
                Calcula usando largo, ancho y alto
              </p>
            </div>
            {dimensionsMode === true && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                ✓
              </div>
            )}
          </button>

          <button
            onClick={() => onModeSelect(false)}
            className={`relative group p-8 rounded-xl transition-all duration-300 
              ${dimensionsMode === false 
                ? 'bg-blue-500/30 border-2 border-blue-400' 
                : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
          >
            <div className="text-center space-y-4">
              <span className="text-5xl block group-hover:animate-bounce">💧</span>
              <span className="text-xl font-medium text-white block">
                Volumen
              </span>
              <p className="text-blue-100/80 text-sm">
                Ingresa directamente los litros
              </p>
            </div>
            {dimensionsMode === false && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                ✓
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}