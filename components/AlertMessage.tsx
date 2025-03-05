export default function AlertMessage({ type, title, message }) {
  const styles = {
    warning: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-400',
      icon: '⚠️',
      text: 'text-yellow-100',
    },
    error: {
      bg: 'bg-red-500/20',
      border: 'border-red-400',
      icon: '❌',
      text: 'text-red-100',
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-400',
      icon: 'ℹ️',
      text: 'text-blue-100',
    },
  };

  const style = styles[type];

  return (
    <div className={`glass-card my-6 ${style.bg}`}>
      <div className="p-6 relative overflow-hidden">
        {/* Fondo animado */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        
        <div className="relative flex items-start space-x-4">
          <div className="text-2xl">{style.icon}</div>
          <div className={`flex-1 ${style.text}`}>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="opacity-90">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}