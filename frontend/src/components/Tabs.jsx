export function TabsContainer({ children }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 flex gap-2">
        {children}
      </div>
    </div>
  );
}

export function Tab({ label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-4 font-heading font-semibold text-sm transition ${
        isActive
          ? 'border-b-2 border-primary text-primary bg-primary-light'
          : 'border-b-2 border-transparent text-gray-700 hover:text-primary'
      }`}
    >
      {label}
    </button>
  );
}

export default { TabsContainer, Tab };
