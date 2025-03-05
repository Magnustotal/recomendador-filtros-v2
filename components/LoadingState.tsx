export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-500/30 rounded-full animate-spin">
          <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 rounded-full animate-spin" 
               style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
        </div>
      </div>
      <p className="mt-4 text-gray-400">Cargando filtros...</p>
    </div>
  );
}